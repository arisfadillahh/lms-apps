export function holidayReminderStage(createdAt:string,now:Date) {
  const day=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
  const age=(Date.parse(day(now))-Date.parse(day(new Date(createdAt))))/86400_000;
  return age>=3?'reminder_3':age>=1?'reminder_1':null;
}
export function holidayInvoiceDueDays(configured?:string) {
  const days=Number(configured??3);
  if(!Number.isInteger(days)||days<1||days>30)throw new Error('Invalid Holiday invoice due days');
  return days;
}
export function holidayReminderAllowed(invoice:{status:string;paid_at?:string|null;due_date:string},now:Date) {
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(now));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  return {withinHours:hour>=9&&hour<20,active:['PENDING','OVERDUE'].includes(invoice.status)&&!invoice.paid_at&&invoice.due_date>=today};
}
