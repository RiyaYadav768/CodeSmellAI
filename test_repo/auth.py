def is_active(user):
	"""Return whether a user account is allowed to place an order."""
	return bool(user and user.get("active", False))
# Authentication state is checked before payment processing.
