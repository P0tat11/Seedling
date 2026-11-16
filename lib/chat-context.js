const AGE_GROUPS = new Set(['6-7', '8-9', '10-12', '13+']);

function text(value, maxLength = 200) {
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeChatContext(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const shops = Array.isArray(input.shops)
    ? input.shops.slice(0, 100).map((source) => {
        const shop = source && typeof source === 'object' ? source : {};
        return {
          id: text(shop.id, 100),
          businessName: text(shop.businessName),
          category: text(shop.category),
          goalItemName: text(shop.goalItemName),
          financialGoal: number(shop.financialGoal),
          durationDays: number(shop.durationDays),
          materialCost: number(shop.materialCost),
          activeDay: number(shop.activeDay),
          earnedBadges: Array.isArray(shop.earnedBadges)
            ? shop.earnedBadges.slice(0, 100).map((badge) => text(badge, 100))
            : [],
          jarAllocations:
            shop.jarAllocations && typeof shop.jarAllocations === 'object'
              ? {
                  goal: number(shop.jarAllocations.goal),
                  supplies: number(shop.jarAllocations.supplies),
                  charity: number(shop.jarAllocations.charity)
                }
              : null,
          products: Array.isArray(shop.products)
            ? shop.products.slice(0, 500).map((sourceProduct) => {
                const product =
                  sourceProduct && typeof sourceProduct === 'object' ? sourceProduct : {};
                return {
                  name: text(product.name),
                  price: number(product.price),
                  unitCost: number(product.unitCost),
                  emoji: text(product.emoji, 16)
                };
              })
            : [],
          sales: sanitizeSales(shop.sales)
        };
      })
    : [];

  const ageGroup = AGE_GROUPS.has(input.ageGroup) ? input.ageGroup : 'unknown';
  return {
    founderName: text(input.founderName),
    ageGroup,
    assistantName: text(input.assistantName),
    mascotId: text(input.mascotId, 100),
    themeId: text(input.themeId, 100),
    tycoonGems: number(input.tycoonGems),
    streakDays: number(input.streakDays),
    activeTab: text(input.activeTab, 100),
    shopOpen: Boolean(input.shopOpen),
    soundMuted: Boolean(input.soundMuted),
    activeShopId: text(input.activeShopId, 100),
    forecastWeather: text(input.forecastWeather, 100),
    forecastDow: text(input.forecastDow, 100),
    liveWeather:
      input.liveWeather && typeof input.liveWeather === 'object'
        ? {
            tempF: number(input.liveWeather.tempF),
            condition: text(input.liveWeather.condition)
          }
        : null,
    cart: Array.isArray(input.cart)
      ? input.cart.slice(0, 100).map((sourceItem) => {
          const item = sourceItem && typeof sourceItem === 'object' ? sourceItem : {};
          return {
            name: text(item.name),
            quantity: number(item.quantity),
            price: number(item.price),
            unitCost: number(item.unitCost)
          };
        })
      : [],
    cartItemsTotal: number(input.cartItemsTotal),
    cartSubtotal: number(input.cartSubtotal),
    tipAmount: number(input.tipAmount),
    metrics:
      input.metrics && typeof input.metrics === 'object'
        ? {
            totalTargetRevenue: number(input.metrics.totalTargetRevenue),
            dailySalesTarget: number(input.metrics.dailySalesTarget),
            breakEvenPoint: number(input.metrics.breakEvenPoint),
            totalRevenueEarned: number(input.metrics.totalRevenueEarned),
            netProfitEarned: number(input.metrics.netProfitEarned),
            hasBrokenEven: Boolean(input.metrics.hasBrokenEven),
            hasReachedGoal: Boolean(input.metrics.hasReachedGoal),
            avgSellingPrice: number(input.metrics.avgSellingPrice),
            avgUnitCost: number(input.metrics.avgUnitCost),
            avgMarginPerItem: number(input.metrics.avgMarginPerItem),
            activeSellingDays: number(input.metrics.activeSellingDays),
            totalLoggedUnits: number(input.metrics.totalLoggedUnits),
            avgLoggedUnitsPerDay:
              input.metrics.avgLoggedUnitsPerDay == null
                ? null
                : number(input.metrics.avgLoggedUnitsPerDay),
            unitsNeededPerDayForGoal: number(input.metrics.unitsNeededPerDayForGoal),
            tomorrowPredictedUnits: number(input.metrics.tomorrowPredictedUnits),
            recommendedPrice: number(input.metrics.recommendedPrice),
            priceAction: text(input.metrics.priceAction),
            tips: Array.isArray(input.metrics.tips)
              ? input.metrics.tips.slice(0, 20).map((tip) => text(tip, 500))
              : []
          }
        : null,
    shops
  };
}

function sanitizeSales(sales) {
  if (!sales || typeof sales !== 'object') return null;
  return {
    transactionCount: number(sales.transactionCount),
    totalRevenue: number(sales.totalRevenue),
    totalProfit: number(sales.totalProfit),
    totalTips: number(sales.totalTips),
    totalUnits: number(sales.totalUnits),
    byDay: Array.isArray(sales.byDay)
      ? sales.byDay.slice(0, 100).map((sourceDay) => {
          const day = sourceDay && typeof sourceDay === 'object' ? sourceDay : {};
          return {
            day: number(day.day),
            transactions: number(day.transactions),
            revenue: number(day.revenue),
            units: number(day.units)
          };
        })
      : [],
    productSales: Array.isArray(sales.productSales)
      ? sales.productSales.slice(0, 500).map((sourceProduct) => {
          const product =
            sourceProduct && typeof sourceProduct === 'object' ? sourceProduct : {};
          return {
            name: text(product.name),
            quantity: number(product.quantity),
            revenue: number(product.revenue)
          };
        })
      : [],
    recentReceipts: Array.isArray(sales.recentReceipts)
      ? sales.recentReceipts.slice(0, 10).map((sourceReceipt) => {
          const receipt =
            sourceReceipt && typeof sourceReceipt === 'object' ? sourceReceipt : {};
          return {
            day: number(receipt.day),
            timestamp: text(receipt.timestamp, 50),
            itemsSummary: text(receipt.itemsSummary, 500),
            unitsCount: number(receipt.unitsCount),
            tip: number(receipt.tip),
            total: number(receipt.total),
            profit: number(receipt.profit),
            items: Array.isArray(receipt.items)
              ? receipt.items.slice(0, 20).map((sourceItem) => {
                  const item =
                    sourceItem && typeof sourceItem === 'object' ? sourceItem : {};
                  return {
                    name: text(item.name),
                    quantity: number(item.quantity),
                    unitPrice: number(item.unitPrice),
                    unitCost: number(item.unitCost)
                  };
                })
              : []
          };
        })
      : []
  };
}

module.exports = { sanitizeChatContext };
