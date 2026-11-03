// Creates the demo workspace used for Marketplace screenshots: a small .NET API
// with a Vue/TypeScript front end, a git history with several authors, a
// feature branch and one uncommitted change.
//
//   node scripts/screenshots/demo-workspace.mjs /tmp/contoso-shop
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const target = path.resolve(process.argv[2] ?? "/tmp/contoso-shop");
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

const write = (file, text) => {
  const full = path.join(target, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, text.replace(/^\n/, ""));
};

const git = (args, author, date) =>
  execFileSync("git", args, {
    cwd: target,
    stdio: "pipe",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: author?.[0] ?? "Onur Karakuş",
      GIT_AUTHOR_EMAIL: author?.[1] ?? "onur@contoso.dev",
      GIT_COMMITTER_NAME: author?.[0] ?? "Onur Karakuş",
      GIT_COMMITTER_EMAIL: author?.[1] ?? "onur@contoso.dev",
      ...(date ? { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } : {}),
    },
  });

const AYSE = ["Ayşe Demir", "ayse@contoso.dev"];
const MEHMET = ["Mehmet Yılmaz", "mehmet@contoso.dev"];
const ONUR = ["Onur Karakuş", "onur@contoso.dev"];

git(["init", "-q", "-b", "main"]);
git(["config", "user.name", "Onur Karakuş"]);
git(["config", "user.email", "onur@contoso.dev"]);
git(["config", "commit.gpgsign", "false"]);

write(".gitignore", "bin/\nobj/\nnode_modules/\ndist/\n");
write("README.md", "# Contoso Shop\n\nOrders API (.NET 8) and a Vue storefront.\n");
write(
  "src/Shop.Api/Services/PaymentService.cs",
  `
namespace Contoso.Shop.Api.Services;

public sealed class PaymentService : IPaymentService
{
    private readonly IPaymentGateway _gateway;

    public PaymentService(IPaymentGateway gateway) => _gateway = gateway;

    public async Task<PaymentResult> ChargeAsync(Order order, CancellationToken token)
    {
        // HACK(ayse, 2026-10-28): gateway rejects amounts with more than two decimals
        var amount = Math.Round(order.Total, 2);
        // BUG: retries can charge twice when the gateway times out
        return await _gateway.ChargeAsync(order.Id, amount, token);
    }

    public Task RefundAsync(Guid orderId, decimal amount, CancellationToken token)
    {
        throw new NotImplementedException("Refunds land in v2");
    }
}
`,
);
write(
  "src/Shop.Api/Data/LegacyOrderRepository.cs",
  `
namespace Contoso.Shop.Api.Data;

[Obsolete("Use OrderRepository with EF Core")]
public sealed class LegacyOrderRepository
{
    // UNDONE: connection pooling was rolled back after the outage
    public IReadOnlyList<Order> Load(int page) => Array.Empty<Order>();
}
`,
);
write(
  "web/src/components/CartSummary.vue",
  `
<template>
  <section class="cart-summary">
    <!-- TODO(mehmet, #a11y): announce total changes to screen readers -->
    <h2>{{ t('cart.total') }}</h2>
    <PriceTag :amount="total" />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCart } from "@/stores/cart";

const cart = useCart();
// OPTIMIZE: memoize per currency instead of recomputing on every render
const total = computed(() => cart.items.reduce((sum, item) => sum + item.price * item.qty, 0));
</script>
`,
);
write(
  "docs/release-checklist.md",
  `
# Release checklist

- [x] Bump API version
- [ ] Update the storefront changelog
- [ ] Run the load test against staging
`,
);
write(
  "scripts/deploy.sh",
  `
#!/usr/bin/env bash
set -euo pipefail
# XXX: hard-coded region until the new pipeline lands
az webapp deploy --resource-group shop-rg --name contoso-shop --src-path ./publish.zip
`,
);
git(["add", "."]);
git(["commit", "-q", "-m", "Initial storefront and payments"], AYSE, "2025-03-14T10:00:00+03:00");

write(
  "src/Shop.Api/Controllers/OrdersController.cs",
  `
using Microsoft.AspNetCore.Mvc;

namespace Contoso.Shop.Api.Controllers;

[ApiController]
[Route("api/orders")]
public sealed class OrdersController : ControllerBase
{
    private readonly IOrderService _orders;

    public OrdersController(IOrderService orders) => _orders = orders;

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrderDto>> Get(Guid id, CancellationToken token)
    {
        // TODO(onur, 2026-11-06, !high, #perf): cache order lookups for 30 seconds
        var order = await _orders.FindAsync(id, token);
        return order is null ? NotFound() : Ok(order.ToDto());
    }

    [HttpPost]
    public async Task<ActionResult<OrderDto>> Create(CreateOrder request, CancellationToken token)
    {
        // FIXME(mehmet): validate the coupon before reserving stock
        var order = await _orders.CreateAsync(request, token);
        return CreatedAtAction(nameof(Get), new { id = order.Id }, order.ToDto());
    }
}
`,
);
write(
  "web/src/api/client.ts",
  `
const baseUrl = "/api";

export async function getJson<T>(path: string): Promise<T> {
  // TODO(onur, 2026-12-15): retry idempotent requests with backoff
  const response = await fetch(\`\${baseUrl}\${path}\`);
  return (await response.json()) as T;
}

// NOTE: the API returns money as strings to keep precision
export const toMoney = (value: string): number => Number.parseFloat(value);
`,
);
git(["add", "."]);
git(["commit", "-q", "-m", "Orders API and fetch client"], MEHMET, "2025-11-20T15:30:00+03:00");

git(["checkout", "-q", "-b", "feature/checkout"]);
write(
  "src/Shop.Api/Services/CheckoutService.cs",
  `
namespace Contoso.Shop.Api.Services;

public sealed class CheckoutService
{
    public async Task<CheckoutResult> CompleteAsync(Cart cart, CancellationToken token)
    {
        // TODO(onur, 2026-11-20, #checkout): split shipping and billing addresses
        var order = Order.FromCart(cart);
        // REVIEW: should failed payments keep the reservation for 15 minutes?
        return await PayAsync(order, token);
    }
}
`,
);
git(["add", "."]);
git(["commit", "-q", "-m", "Checkout service skeleton"], ONUR, "2026-10-30T11:00:00+03:00");

// Uncommitted work.
const payment = path.join(target, "web/src/components/CartSummary.vue");
fs.writeFileSync(
  payment,
  fs
    .readFileSync(payment, "utf8")
    .replace(
      "const cart = useCart();",
      "const cart = useCart();\n// FIXME(onur, !high): empty carts show NaN in Safari",
    ),
);
console.log(target);
