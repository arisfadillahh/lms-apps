type OrderedClassBlock = {
  id: string;
  created_at: string;
  start_date: string;
  block_order_index?: number | null;
};

// Class blocks may repeat when a curriculum cycles. Creation order identifies
// the class sequence; template order breaks ties without trusting stale dates.
export function compareClassBlocksInLessonOrder(a: OrderedClassBlock, b: OrderedClassBlock): number {
  const createdDiff = Date.parse(a.created_at) - Date.parse(b.created_at);
  if (createdDiff !== 0) return createdDiff;

  const templateDiff = (a.block_order_index ?? Number.MAX_SAFE_INTEGER)
    - (b.block_order_index ?? Number.MAX_SAFE_INTEGER);
  if (templateDiff !== 0) return templateDiff;

  const dateDiff = Date.parse(a.start_date) - Date.parse(b.start_date);
  return dateDiff || a.id.localeCompare(b.id);
}
