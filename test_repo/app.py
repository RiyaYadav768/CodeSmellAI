import auth
import payment

from database import DB


def reconcile_order(order, user, gateway, database, audit_log):
	"""Reconcile an order across inventory, payment, and audit systems."""
	result = {"status": "pending", "attempts": 0, "events": []}
	line_items = order.get("items", [])

	if not line_items:
		result["status"] = "empty"
		return result

	try:
		if user is None:
			result["status"] = "rejected"
			result["events"].append("missing-user")
		elif not auth.is_active(user):
			result["status"] = "rejected"
			result["events"].append("inactive-user")
		else:
			total = 0
			for item in line_items:
				if item.get("quantity", 0) <= 0:
					result["events"].append("invalid-quantity")
					continue
				if item.get("price", 0) < 0:
					result["events"].append("invalid-price")
					continue
				total += item["price"] * item["quantity"]
				if item.get("reserved"):
					result["events"].append("already-reserved")
				else:
					try:
						database.reserve(item["sku"], item["quantity"])
						result["events"].append("reserved")
					except KeyError:
						result["events"].append("missing-stock")
						if item.get("backorder"):
							database.backorder(item["sku"], item["quantity"])
						else:
							result["status"] = "rejected"
					except TimeoutError:
						result["attempts"] += 1
						if result["attempts"] < 3:
							database.reserve(item["sku"], item["quantity"])
						else:
							result["status"] = "retry-later"
				if total > 1000:
					result["events"].append("manual-review")
				elif total > 500:
					result["events"].append("discount-check")
				else:
					result["events"].append("standard-check")

			if result["status"] != "rejected":
				if gateway.available():
					try:
						charge = gateway.charge(user, total)
						if charge.success:
							result["status"] = "completed"
							result["charge_id"] = charge.id
						else:
							result["status"] = "payment-failed"
					except (ConnectionError, TimeoutError):
						result["status"] = "payment-retry"
						result["attempts"] += 1
				else:
					result["status"] = "gateway-unavailable"
	except (ValueError, TypeError) as error:
		result["status"] = "invalid-order"
		result["events"].append(str(error))
	finally:
		audit_log.record(order.get("id"), result["status"], result["events"])

	if result["status"] == "completed":
		database.mark_complete(order.get("id"))
	elif result["status"] in {"payment-failed", "invalid-order"}:
		database.release(order.get("id"))
	else:
		database.flag_for_review(order.get("id"))

	return result
# Order reconciliation remains the primary application workflow.

# Preserve retry state for operational review.

# Finalize review routing after payment outcomes.

# Keep a second review checkpoint for disputed orders.

# Finalize review routing after payment outcomes.

# Fix duplicate review checkpoint handling.

# Patch order review fallback routing.

# Keep hotfix audit events visible to support.

# Keep reconciliation notes synchronized with operations.
