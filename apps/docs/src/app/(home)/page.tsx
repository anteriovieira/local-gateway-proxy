import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="max-w-2xl py-16">
        <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
          Proxy App
        </h1>
        <p className="mb-2 text-lg text-fd-muted-foreground md:text-xl">
          A local API Gateway proxy for development and testing.
        </p>
        <p className="mb-8 text-fd-muted-foreground">
          Intercept, proxy, and mock HTTP requests with an AWS API
          Gateway-style config. Available as a Chrome Extension and Desktop App.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/docs"
            className="inline-flex items-center rounded-lg bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
          >
            Get Started
          </Link>
          <a
            href="https://chromewebstore.google.com/detail/proxy-app/gdhjkolpmofllkogghodpnnmjajnbilg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-fd-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-fd-accent"
          >
            Chrome Extension
          </a>
        </div>

        <div className="mt-16 grid gap-6 text-left sm:grid-cols-2">
          <div className="rounded-lg border border-fd-border p-5">
            <h3 className="mb-1 font-semibold">Endpoint Management</h3>
            <p className="text-sm text-fd-muted-foreground">
              Define API endpoints with HTTP methods, path parameters, and stage
              variables. Enable or disable individual routes on the fly.
            </p>
          </div>
          <div className="rounded-lg border border-fd-border p-5">
            <h3 className="mb-1 font-semibold">Mock Responses</h3>
            <p className="text-sm text-fd-muted-foreground">
              Return fixed JSON responses with custom status codes, headers, and
              simulated delays — no backend needed.
            </p>
          </div>
          <div className="rounded-lg border border-fd-border p-5">
            <h3 className="mb-1 font-semibold">Mock Database</h3>
            <p className="text-sm text-fd-muted-foreground">
              An in-memory CRUD database for prototyping. Handles GET, POST, PUT,
              PATCH, and DELETE automatically.
            </p>
          </div>
          <div className="rounded-lg border border-fd-border p-5">
            <h3 className="mb-1 font-semibold">Request Logging</h3>
            <p className="text-sm text-fd-muted-foreground">
              Inspect every proxied and mocked request with full details: headers,
              body, status code, and timing.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
