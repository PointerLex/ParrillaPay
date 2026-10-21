function allocateCents(totalCents, userIds) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || userIds.length === 0) {
    throw new Error("A positive participant list and integer cents are required.");
  }
  const uniqueIds = [...new Set(userIds)];
  const base = Math.floor(totalCents / uniqueIds.length);
  let remainder = totalCents - base * uniqueIds.length;
  return uniqueIds.map((userId) => ({
    userId,
    cents: base + (remainder-- > 0 ? 1 : 0),
  }));
}

function settleBalances(balances) {
  const debtors = [...balances].filter(([, balance]) => balance < 0)
    .map(([userId, balance]) => ({ userId, cents: -balance }));
  const creditors = [...balances].filter(([, balance]) => balance > 0)
    .map(([userId, balance]) => ({ userId, cents: balance }));
  const settlements = [];

  for (const debtor of debtors) {
    for (const creditor of creditors) {
      if (debtor.cents === 0 || creditor.cents === 0 || debtor.userId === creditor.userId) continue;
      const cents = Math.min(debtor.cents, creditor.cents);
      settlements.push({ debtorId: debtor.userId, creditorId: creditor.userId, cents });
      debtor.cents -= cents;
      creditor.cents -= cents;
    }
  }
  return settlements;
}

module.exports = { allocateCents, settleBalances };
