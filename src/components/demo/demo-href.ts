/** Endereço da página atual com a camada de demo aberta (`?demo=<id>`). */
export function openDemoHref(pathname: string, search: string, demoId: string): string {
  const params = new URLSearchParams(search);
  params.set("demo", demoId);
  return `${pathname}?${params.toString()}`;
}

/** Endereço da página atual sem a camada. */
export function closeDemoHref(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete("demo");
  const rest = params.toString();
  return rest ? `${pathname}?${rest}` : pathname;
}
