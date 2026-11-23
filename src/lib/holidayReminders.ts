export function holidayReminderStage(createdAt:string,now:Date) {
  const age=now.getTime()-Date.parse(createdAt);
  return age>=3*86400_000?'reminder_3':age>=86400_000?'reminder_1':null;
}
export function holidayReminderAllowed(invoice:{status:string;paid_at?:string|null;due_date:string},now:Date) {
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(now));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return {withinHours:hour>=9&&hour<20,active:['PENDING','OVERDUE'].includes(invoice.status)&&!invoice.paid_at&&invoice.due_date>=today};
}
