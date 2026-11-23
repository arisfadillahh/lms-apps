import { z } from 'zod';
export const holidayAttributionSchema = z.object({
  utm_source:z.string().max(200).optional(), utm_medium:z.string().max(200).optional(),
  utm_campaign:z.string().max(200).optional(), utm_content:z.string().max(200).optional(), utm_term:z.string().max(200).optional(),
  fbclid:z.string().max(500).optional(), fbp:z.string().max(200).optional(), fbc:z.string().max(600).optional(),
});
export type HolidayAttribution = z.infer<typeof holidayAttributionSchema> & { client_user_agent?:string; client_ip_address?:string; measurement?:boolean };
export function holidayEventId(name:'CompleteRegistration'|'InitiateCheckout'|'Purchase', registrationId:string, invoiceNumber:string) {
  return name==='CompleteRegistration' ? registrationId : name==='Purchase' ? invoiceNumber : `checkout:${invoiceNumber}`;
}
