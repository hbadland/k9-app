export const PRODUCTS = {
  single: {
    key: 'single' as const,
    label: 'Single Walk',
    description: 'One-off walk — pay as you go',
    pricePence: 2500,
    credits: 1,
    mode: 'payment' as const,
  },
  bundle5: {
    key: 'bundle5' as const,
    label: '5 Walk Bundle',
    description: 'Buy 5 walks — save £15 vs single price',
    pricePence: 11000,
    credits: 5,
    mode: 'payment' as const,
  },
  bundle10: {
    key: 'bundle10' as const,
    label: '10 Walk Bundle',
    description: 'Buy 10 walks — best value, save £50',
    pricePence: 20000,
    credits: 10,
    mode: 'payment' as const,
  },
  subscription: {
    key: 'subscription' as const,
    label: 'Monthly Plan',
    description: '5 walks per month, priority booking, auto-renews',
    pricePence: 8000,
    credits: 5,
    mode: 'subscription' as const,
  },
} as const;

export type ProductKey = keyof typeof PRODUCTS;
