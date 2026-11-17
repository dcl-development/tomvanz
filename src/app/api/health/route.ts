// A liveness check for uptime monitors. It answers instantly and never touches Sanity,
// so pinging it as often as you like costs nothing in Sanity usage.
export function GET() {
  return Response.json({ok: true}, {headers: {'cache-control': 'no-store'}})
}
