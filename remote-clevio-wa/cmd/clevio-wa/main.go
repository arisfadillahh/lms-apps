package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"regexp"
	"strings"
	"sync"
	"syscall"
	"time"

	"clevio-whatsmeow/internal/bridge"
	"clevio-whatsmeow/internal/store"

	_ "github.com/mattn/go-sqlite3"
	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

type App struct {
	wa           *whatsmeow.Client
	ai           *bridge.Client
	escalations  *store.EscalationStore
	teamJID      types.JID
	dedupMu      sync.Mutex
	recentDirect map[string]time.Time
	queueMu      sync.Mutex
	directQueues map[string]chan directRequest
}

type directRequest struct {
	info types.MessageInfo
	text string
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	dataDir := env("CLEVIO_WA_DATA_DIR", "/root/clevio-whatsmeow/data")
	teamRaw := env("CLEVIO_TEAM_JID", "120363299465478999@g.us")
	teamJID, _ := types.ParseJID(teamRaw)

	dbLog := waLog.Stdout("DB", "WARN", true)
	container, err := sqlstore.New(ctx, "sqlite3", "file:"+dataDir+"/whatsmeow.db?_foreign_keys=on", dbLog)
	if err != nil {
		log.Fatalf("open whatsmeow store: %v", err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		log.Fatalf("get device: %v", err)
	}

	clientLog := waLog.Stdout("WA", "INFO", true)
	wa := whatsmeow.NewClient(device, clientLog)
	app := &App{
		wa:           wa,
		ai:           bridge.NewClient(),
		escalations:  store.NewEscalationStore(dataDir + "/escalations.json"),
		teamJID:      teamJID,
		recentDirect: make(map[string]time.Time),
		directQueues: make(map[string]chan directRequest),
	}
	wa.AddEventHandler(app.handleEvent)

	if wa.Store.ID == nil {
		qrChan, err := wa.GetQRChannel(ctx)
		if err != nil {
			log.Fatalf("get qr channel: %v", err)
		}
		if err := wa.Connect(); err != nil {
			log.Fatalf("connect: %v", err)
		}
		for evt := range qrChan {
			if evt.Event == "code" {
				qrPath := dataDir + "/login-qr.png"
				if err := qrcode.WriteFile(evt.Code, qrcode.Medium, 512, qrPath); err != nil {
					log.Printf("write qr png failed: %v", err)
				}
				fmt.Println("Scan QR ini untuk login WhatsApp:")
				fmt.Println(evt.Code)
				fmt.Println("QR PNG:", qrPath)
			} else {
				log.Printf("QR event: %s", evt.Event)
			}
		}
	} else {
		if err := wa.Connect(); err != nil {
			log.Fatalf("connect: %v", err)
		}
	}

	log.Printf("Clevio WhatsMeow CS started. Old WWebJS path should stay stopped. Team JID: %s", app.teamJID.String())
	<-ctx.Done()
	wa.Disconnect()
}

func (a *App) handleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Message:
		a.handleMessage(v)
	}
}

func (a *App) handleMessage(evt *events.Message) {
	msg := evt.Message
	if msg == nil || evt.Info.IsFromMe || evt.Info.Chat.Server == types.BroadcastServer {
		return
	}
	text := strings.TrimSpace(messageText(msg))
	if text == "" {
		return
	}

	chat := evt.Info.Chat
	if chat.Server == types.GroupServer {
		// Only the configured team group is allowed to resolve escalations.
		// Other groups stay silent to avoid accidental customer/data leakage.
		if !a.teamJID.IsEmpty() && chat.ToNonAD() == a.teamJID.ToNonAD() {
			info := evt.Info
			go a.handleTeamGroupReply(info, msg, text)
		}
		return
	}

	if !a.beginDirectDedup(evt.Info, text) {
		log.Printf("ignored duplicate direct event chat=%s sender=%s sender_alt=%s text=%q", evt.Info.Chat.String(), evt.Info.Sender.String(), evt.Info.SenderAlt.String(), text)
		return
	}

	a.enqueueDirectMessage(evt.Info, text)
}

func (a *App) enqueueDirectMessage(info types.MessageInfo, text string) {
	key := info.Chat.ToNonAD().String()
	if key == "" {
		key = info.Chat.String()
	}

	a.queueMu.Lock()
	queue, ok := a.directQueues[key]
	if !ok {
		queue = make(chan directRequest, 32)
		a.directQueues[key] = queue
		go a.runDirectQueue(key, queue)
	}
	select {
	case queue <- directRequest{info: info, text: text}:
	default:
		log.Printf("direct queue full chat=%s text=%q", key, text)
	}
	a.queueMu.Unlock()
}

func (a *App) runDirectQueue(key string, queue chan directRequest) {
	idle := time.NewTimer(30 * time.Minute)
	defer idle.Stop()
	for {
		var first directRequest
		select {
		case first = <-queue:
			if !idle.Stop() {
				select {
				case <-idle.C:
				default:
				}
			}
		case <-idle.C:
			a.queueMu.Lock()
			if current, ok := a.directQueues[key]; ok && current == queue && len(queue) == 0 {
				delete(a.directQueues, key)
				a.queueMu.Unlock()
				return
			}
			a.queueMu.Unlock()
			idle.Reset(30 * time.Minute)
			continue
		}
		batch := []directRequest{first}
		timer := time.NewTimer(1500 * time.Millisecond)
	collect:
		for {
			select {
			case next := <-queue:
				batch = append(batch, next)
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				timer.Reset(1500 * time.Millisecond)
			case <-timer.C:
				break collect
			}
		}

		latest := batch[len(batch)-1].info
		texts := make([]string, 0, len(batch))
		for _, request := range batch {
			texts = append(texts, strings.TrimSpace(request.text))
		}
		combined := strings.Join(texts, "\n")
		if len(batch) > 1 {
			log.Printf("combined direct messages chat=%s count=%d", key, len(batch))
		}
		a.respondToDirectMessage(latest, combined)
		idle.Reset(30 * time.Minute)
	}
}

func (a *App) beginDirectDedup(info types.MessageInfo, text string) bool {
	chatKey := info.Chat.ToNonAD().String()
	if chatKey == "" {
		chatKey = info.Chat.String()
	}
	stamp := info.Timestamp.Unix()
	if stamp <= 0 {
		stamp = time.Now().Unix() / 30
	}
	normalizedText := strings.Join(strings.Fields(strings.ToLower(strings.TrimSpace(text))), " ")
	key := fmt.Sprintf("%s|%d|%s", chatKey, stamp, normalizedText)

	now := time.Now()
	a.dedupMu.Lock()
	defer a.dedupMu.Unlock()
	for k, seenAt := range a.recentDirect {
		if now.Sub(seenAt) > 5*time.Minute {
			delete(a.recentDirect, k)
		}
	}
	if _, exists := a.recentDirect[key]; exists {
		return false
	}
	a.recentDirect[key] = now
	return true
}

func (a *App) respondToDirectMessage(info types.MessageInfo, text string) {
	chat := info.Chat
	target := replyTarget(info)
	log.Printf("incoming direct chat=%s sender=%s sender_alt=%s target=%s text=%q", chat.String(), info.Sender.String(), info.SenderAlt.String(), target.String(), text)

	ctx := context.Background()
	stopTyping := a.startTyping(ctx, target)
	defer stopTyping()

	res, err := a.ai.ReplyForCustomer(ctx, chat.String(), text)
	if err != nil {
		// No template fallback. Log only; do not send a canned customer message.
		log.Printf("AI error for %s: %v", chat.String(), err)
		return
	}
	log.Printf("AI result chat=%s mode=%s reply_len=%d", chat.String(), res.Mode, len(strings.TrimSpace(res.CustomerReply)))

	if res.Mode == bridge.ModeNoReply || strings.TrimSpace(res.CustomerReply) == "" {
		return
	}
	if err := a.sendText(ctx, target, res.CustomerReply); err != nil {
		log.Printf("send customer reply failed chat=%s target=%s: %v", chat.String(), target.String(), err)
		return
	}
	log.Printf("sent customer reply chat=%s target=%s", chat.String(), target.String())

	if res.Mode == bridge.ModeEscalate && strings.TrimSpace(res.TeamMessage) != "" && !a.teamJID.IsEmpty() {
		teamText := strings.Join([]string{
			"ID Kasus: " + res.CaseID,
			"Chat ID: " + chat.String(),
			"Pertanyaan customer: " + text,
			"Needed from team: " + res.TeamMessage,
		}, "\n")
		teamCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		teamResp, sendErr := a.wa.SendMessage(teamCtx, a.teamJID, &waProto.Message{Conversation: proto.String(teamText)})
		cancel()
		if sendErr != nil {
			log.Printf("send team escalation failed: %v", sendErr)
		}
		_ = a.escalations.Add(store.Escalation{CaseID: res.CaseID, CustomerChatID: chat.String(), CustomerText: text, TeamMessageID: string(teamResp.ID), CreatedAt: time.Now().UTC()})
	}
}

var caseIDPattern = regexp.MustCompile(`(?i)esc_[0-9]{8}_[0-9]{6}`)

func (a *App) handleTeamGroupReply(info types.MessageInfo, msg *waProto.Message, text string) {
	caseID, esc, ok := a.matchEscalation(msg, text)
	if !ok {
		// Hard-match only: no case id / no quoted escalation => stay silent.
		log.Printf("ignored team group message without hard escalation match sender=%s text=%q", info.Sender.String(), text)
		return
	}
	answer := cleanTeamAnswer(text)
	if answer == "" || strings.EqualFold(answer, caseID) {
		log.Printf("ignored empty team answer case=%s sender=%s", caseID, info.Sender.String())
		return
	}
	customerJID, err := types.ParseJID(esc.CustomerChatID)
	if err != nil || customerJID.IsEmpty() {
		log.Printf("invalid customer jid for case=%s jid=%q err=%v", caseID, esc.CustomerChatID, err)
		return
	}
	ctx := context.Background()
	if err := a.sendText(ctx, customerJID.ToNonAD(), answer); err != nil {
		log.Printf("send team answer failed case=%s customer=%s: %v", caseID, customerJID.String(), err)
		return
	}
	_ = a.escalations.Resolve(caseID)
	log.Printf("forwarded team answer case=%s customer=%s len=%d", caseID, customerJID.String(), len(answer))
}

func (a *App) matchEscalation(msg *waProto.Message, text string) (string, store.Escalation, bool) {
	for _, source := range []string{text, quotedText(msg)} {
		if id := caseIDPattern.FindString(source); id != "" {
			if esc, ok := a.escalations.Get(id); ok && esc.ResolvedAt.IsZero() {
				return id, esc, true
			}
		}
	}
	if stanzaID := quotedStanzaID(msg); stanzaID != "" {
		if esc, ok := a.escalations.FindByTeamMessageID(stanzaID); ok && esc.ResolvedAt.IsZero() {
			return esc.CaseID, esc, true
		}
	}
	return "", store.Escalation{}, false
}

func quotedText(msg *waProto.Message) string {
	if msg.GetExtendedTextMessage() == nil || msg.GetExtendedTextMessage().GetContextInfo() == nil {
		return ""
	}
	return messageText(msg.GetExtendedTextMessage().GetContextInfo().GetQuotedMessage())
}

func quotedStanzaID(msg *waProto.Message) string {
	if msg.GetExtendedTextMessage() == nil || msg.GetExtendedTextMessage().GetContextInfo() == nil {
		return ""
	}
	return msg.GetExtendedTextMessage().GetContextInfo().GetStanzaID()
}

func cleanTeamAnswer(text string) string {
	answer := strings.TrimSpace(caseIDPattern.ReplaceAllString(text, ""))
	answer = strings.TrimSpace(strings.Trim(answer, "-–—:;,. \n\t"))
	return answer
}

func replyTarget(info types.MessageInfo) types.JID {
	// New WhatsApp accounts often receive DMs as LID chats, while the real phone-number
	// JID is available in SenderAlt. Send replies to the PN JID when present so the
	// customer sees the response in the normal phone-number chat. SendMessage requires
	// a non-AD JID, so strip any device/agent part like `:16`.
	if info.Chat.Server == types.HiddenUserServer && !info.SenderAlt.IsEmpty() {
		return info.SenderAlt.ToNonAD()
	}
	return info.Chat.ToNonAD()
}

func (a *App) startTyping(ctx context.Context, to types.JID) func() {
	typingCtx, cancel := context.WithCancel(ctx)
	go func() {
		_ = a.wa.SendChatPresence(typingCtx, to, types.ChatPresenceComposing, types.ChatPresenceMediaText)
		ticker := time.NewTicker(8 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-typingCtx.Done():
				return
			case <-ticker.C:
				_ = a.wa.SendChatPresence(typingCtx, to, types.ChatPresenceComposing, types.ChatPresenceMediaText)
			}
		}
	}()
	return func() {
		cancel()
		pauseCtx, pauseCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer pauseCancel()
		_ = a.wa.SendChatPresence(pauseCtx, to, types.ChatPresencePaused, types.ChatPresenceMediaText)
	}
}

func (a *App) sendText(ctx context.Context, to types.JID, text string) error {
	sendCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	_, err := a.wa.SendMessage(sendCtx, to, &waProto.Message{Conversation: proto.String(text)})
	return err
}

func messageText(msg *waProto.Message) string {
	if msg.GetConversation() != "" {
		return msg.GetConversation()
	}
	if msg.GetExtendedTextMessage() != nil {
		return msg.GetExtendedTextMessage().GetText()
	}
	if msg.GetImageMessage() != nil {
		return msg.GetImageMessage().GetCaption()
	}
	if msg.GetVideoMessage() != nil {
		return msg.GetVideoMessage().GetCaption()
	}
	return ""
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
