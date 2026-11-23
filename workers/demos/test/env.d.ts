import type { Env as DemoEnv } from "../src/env";

declare global {
  namespace Cloudflare {
    interface Env extends DemoEnv {}
  }
}
