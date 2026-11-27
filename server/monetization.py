"""Bhumi Social AI monetization catalogue.

Prices are launch suggestions in INR. This module intentionally does not collect
payments: checkout stays disabled until merchant KYC, payment provider, Play
Billing policy review, tax details, and refund/support workflows are configured.
"""
from flask import Blueprint, jsonify

monetization_bp = Blueprint("monetization", __name__)

CATALOG = {
    "currency": "INR",
    "payments_enabled": False,
    "notice": "Prices are planned launch prices. Payments are not enabled yet.",
    "services": [
        {
            "id": "creator_boost",
            "name": "Creator Boost",
            "category": "creator",
            "price": 49,
            "billing": "one_time",
            "duration_days": 3,
            "description": "Promote one eligible post or reel for three days.",
            "features": ["Sponsored label", "Promotion status", "Basic reach report"],
            "status": "coming_soon",
        },
        {
            "id": "business_promotion",
            "name": "Business Promotion",
            "category": "business",
            "price": 199,
            "billing": "one_time",
            "duration_days": 7,
            "description": "A clearly labelled sponsored business post for seven days.",
            "features": ["Business post placement", "Sponsored label", "Basic campaign report"],
            "status": "coming_soon",
        },
        {
            "id": "premium_membership",
            "name": "Bhumi Premium",
            "category": "membership",
            "price": 99,
            "billing": "monthly",
            "duration_days": 30,
            "description": "Premium profile badge, profile customization and enhanced creator insights as those features become available.",
            "features": ["Premium badge", "Profile customization", "Enhanced insights"],
            "status": "coming_soon",
        },
        {
            "id": "featured_business",
            "name": "Featured Business Listing",
            "category": "business",
            "price": 299,
            "billing": "monthly",
            "duration_days": 30,
            "description": "A featured business profile in the Bhumi business discovery area.",
            "features": ["Featured business profile", "Contact and location details", "Monthly listing report"],
            "status": "coming_soon",
        },
        {
            "id": "fan_support",
            "name": "Fan Support",
            "category": "creator",
            "price_options": [10, 25, 50],
            "platform_commission_percent": 10,
            "billing": "one_time",
            "description": "Fans can send a small voluntary tip to support a creator. Platform commission is planned at 10% of successful tips, before payment-provider fees and applicable taxes.",
            "features": ["₹10, ₹25 or ₹50 support", "Creator support history", "Clear fee disclosure"],
            "status": "coming_soon",
        },
        {
            "id": "brand_collaboration",
            "name": "Brand Collaboration",
            "category": "marketplace",
            "platform_commission_percent": 10,
            "billing": "per_completed_deal",
            "description": "Connect brands with creators. Bhumi earns a planned 10% commission only on completed paid collaborations.",
            "features": ["Brand campaign brief", "Creator applications", "Deal status and completion record"],
            "status": "coming_soon",
        },
    ],
}


@monetization_bp.get("/api/monetization/catalog")
def monetization_catalog():
    return jsonify(CATALOG)


@monetization_bp.get("/monetization")
def monetization_page():
    cards = []
    for item in CATALOG["services"]:
        if "price" in item:
            price = f'₹{item["price"]:,}'
            if item["billing"] == "monthly":
                price += " / month"
            elif item.get("duration_days"):
                price += f' / {item["duration_days"]} days'
        elif "price_options" in item:
            price = " / ".join(f'₹{amount}' for amount in item["price_options"])
        else:
            price = f'{item["platform_commission_percent"]}% on completed deal'
        cards.append(
            "<article><span>" + item["category"].replace("_", " ").title()
            + "</span><h2>" + item["name"] + "</h2><strong>" + price
            + "</strong><p>" + item["description"] + "</p><small>Coming soon — payments are not enabled.</small></article>"
        )
    html = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bhumi Social AI · Creator & Business</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#090611;color:#f6f1ff;font:16px/1.55 system-ui,Arial,sans-serif}
main{max-width:980px;margin:auto;padding:28px 18px 48px}.hero{padding:28px;border:1px solid #49356b;border-radius:22px;background:linear-gradient(135deg,#1b102b,#100b1c)}
h1{margin:0 0 8px;font-size:clamp(28px,6vw,42px)}.muted{color:#c5b9d7}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-top:20px}
article{background:#151020;border:1px solid #38294d;border-radius:18px;padding:20px}article span{font-size:12px;color:#d8b86a;text-transform:uppercase;letter-spacing:.08em}
h2{font-size:20px;margin:8px 0}strong{font-size:24px;color:#e5c879}p{color:#cfc6db}small{display:inline-block;color:#d8b86a;border:1px solid #6a5426;border-radius:20px;padding:5px 9px}
footer{margin-top:24px;color:#b7adc6;font-size:13px}
</style></head><body><main><section class="hero"><h1>Bhumi Creator & Business</h1>
<p class="muted">Promote your work, grow your audience and build partnerships on Bhumi Social AI.</p>
<p class="muted">Launch prices are planned in INR. Payment and checkout will open after business and payment setup is complete.</p></section>
<section class="grid">""" + "".join(cards) + """</section>
<footer>All promotions will be labelled clearly. Reach is not guaranteed. Refund, eligibility, tax and payment-provider terms will be shown before checkout is enabled.</footer>
</main></body></html>"""
    return html
