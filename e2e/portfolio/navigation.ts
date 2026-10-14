export const useRouter = () => ({
  push: (url: string) => window.dispatchEvent(new CustomEvent('qa-route',{detail:url})),
  back: () => window.dispatchEvent(new CustomEvent('qa-route',{detail:'back'})),
  refresh: () => {},
});
