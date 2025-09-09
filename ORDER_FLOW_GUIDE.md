# YieldBet Order Flow Implementation

This document describes the order management system implemented in the YieldBet contract.

## Overview

The system supports creating, settling, and canceling orders for stock trading with the following features:

- **Sell Orders**: Created via `CreateOrder` action
- **Buy Orders**: Created automatically when USD is transferred to contract with order details
- **Market Orders**: Execute immediately at current market price with slippage
- **Limit Orders**: Execute only when price conditions are met
- **Automatic Settlement**: Limit orders are automatically checked and settled via cron jobs
- **Manual Settlement**: Orders can be manually triggered for settlement
- **Order Cancellation**: Pending orders can be cancelled

## Order Creation Flow

### Sell Orders
Use the `CreateOrder` action to create sell orders.

### Buy Orders
Buy orders are created by transferring USD to the YieldBet contract with order details in the transfer data:

1. Send a `Transfer` message to the MockUSD contract
2. Set `recipient` to the YieldBet contract address
3. Include order details in the `data` field as JSON
4. The YieldBet contract receives a `Credit-Notice` and creates the buy order

## Data Structures

### Order Structure
```lua
{
    user_process = "user_process_id",
    ticker = "AAPL",
    amount = 100,
    price = 150.50,
    side = "buy", -- or "sell"
    orderType = "limit", -- or "market"
    status = "pending", -- "filled", "cancelled"
    timestamp = 1234567890,
    slippage = 0.001,
    transferredAmount = 15000, -- only for buy orders
    executionPrice = 150.45, -- set when filled
    executionTime = 1234567890, -- set when filled
    totalCost = 15045, -- set when filled
    stockFee = 1.0, -- 0.1% fee on stock amount, set when filled
    moneyFee = 150.45, -- 0.1% fee on money amount, set when filled
    netStockAmount = 99.0, -- stock amount after fee, set when filled
    netMoneyAmount = 14894.55, -- money amount after fee, set when filled
    cancelledAt = 1234567890 -- set when cancelled
}
```

### State Variables Added
- `Orders`: Map of orderId → order object
- `NextOrderId`: Auto-incrementing order ID counter
- `UserOrders`: Map of user_process → array of order IDs

## API Usage

### 1. Create Sell Order

**Action**: `CreateOrder`

**Note**: This action is only for sell orders. Buy orders are created via USD transfer.

**Parameters**:
- `orderType`: "market" or "limit"
- `ticker`: Stock symbol (e.g., "AAPL")
- `amount`: Number of shares (positive number)
- `price`: Limit price (required for limit orders, ignored for market orders)
- `side`: Must be "sell"
- `slippage`: Optional, defaults to 0.001 (0.1%)

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'CreateOrder',
    orderType = 'limit',
    ticker = 'AAPL',
    amount = 100,
    price = 150.00,
    side = 'sell',
    slippage = 0.002
})
```

**Response**: `CreateOrderResponse`
```lua
{
    success = true,
    orderId = "1",
    order = { ... } -- full order object
}
```

### 1B. Create Buy Order

**Method**: Transfer USD to YieldBet contract with order details

**Step 1**: Send Transfer to MockUSD
```lua
send({
    target = mock_usd_process,
    action = 'Transfer',
    recipient = yield_bet_process,
    quantity = '15000', -- amount of USD to transfer
    data = json.encode({
        orderType = 'limit',
        ticker = 'AAPL',
        amount = 100,
        price = 150.00,
        slippage = 0.002
    })
})
```

**Step 2**: YieldBet receives Credit-Notice and creates buy order

**Response**: `CreateBuyOrderResponse`
```lua
{
    success = true,
    orderId = "2",
    order = { ... }, -- full order object
    message = "Buy order created successfully"
}
```

### 2. Settle Order (Manual)

**Action**: `SettleOrder`

**Parameters**:
- `orderId`: ID of the order to settle

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'SettleOrder',
    orderId = '1'
})
```

**Response**: `SettleOrderResponse`
```lua
{
    success = true,
    orderId = "1",
    executionPrice = 150.45,
    totalCost = 15045,
    stockFee = 1.0,
    moneyFee = 150.45,
    netStockAmount = 99.0,
    netMoneyAmount = 14894.55,
    message = "Order settled successfully with 0.1% fee deducted"
}
```

### 3. Cancel Order

**Action**: `CancelOrder`

**Parameters**:
- `orderId`: ID of the order to cancel

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'CancelOrder',
    orderId = '1'
})
```

**Response**: `CancelOrderResponse`
```lua
{
    success = true,
    orderId = "1",
    message = "Order cancelled successfully" -- For buy orders: "Order cancelled successfully and USD refunded"
}
```

### 4. Get User Orders

**Action**: `GetUserOrders`

**Parameters**: None

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'GetUserOrders'
})
```

**Response**: `GetUserOrdersResponse`
```lua
{
    success = true,
    orders = {
        ["1"] = { ... }, -- order object
        ["2"] = { ... }  -- order object
    }
}
```

### 5. Get Specific Order

**Action**: `GetOrder`

**Parameters**:
- `orderId`: ID of the order to retrieve

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'GetOrder',
    orderId = '1'
})
```

**Response**: `GetOrderResponse`
```lua
{
    success = true,
    order = { ... } -- full order object
}
```

### 6. Get Market Prices

**Action**: `GetMarketPrices`

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'GetMarketPrices'
})
```

**Response**: `GetMarketPricesResponse`
```lua
{
    success = true,
    prices = {
        ["AAPL"] = 150.45,
        ["GOOGL"] = 2500.00
    }
}
```

### 7. Get Available Stocks

**Action**: `GetAvailableStocks`

**Example Message**:
```lua
send({
    target = yield_bet_process,
    action = 'GetAvailableStocks'
})
```

**Response**: `GetAvailableStocksResponse`
```lua
{
    success = true,
    stocks = {
        ["AAPL"] = true,
        ["GOOGL"] = true
    }
}
```

## Order Flow Logic

### Sell Orders (via CreateOrder)
1. Validate that side is "sell"
2. Validate input parameters
3. For market orders: get current price and apply negative slippage
4. Create order and mark as pending
5. For market orders: immediately attempt settlement
6. Settlement executes stock burn and USD transfer to user

### Buy Orders (via USD Transfer)
1. User transfers USD to YieldBet contract with order details in data
2. YieldBet receives Credit-Notice message
3. Parse order details from msg.data JSON
4. Validate input parameters
5. Check transferred amount is sufficient for order
6. For market orders: get current price and apply positive slippage
7. Create order and mark as pending
8. For market orders: immediately attempt settlement
9. Settlement executes stock mint for user (USD already received)

### Settlement Process
1. Check if order exists and is pending
2. Verify current market price is available
3. For limit orders, check if price conditions are met
4. Calculate total cost and apply 0.1% fee
5. Execute transfers:
   - **Buy orders**: Mint stock for user (minus 0.1% fee)
   - **Sell orders**: Burn stock from user (full amount), transfer USD to user (minus 0.1% fee)
6. Update order status to "filled" with fee details

### Cancellation Process
1. Verify order exists and belongs to requesting user
2. Check order is in pending status
3. **For buy orders**: Refund the transferred USD amount back to user
4. **For sell orders**: No refund needed (no money was transferred)
5. Update order status to "cancelled"
6. Set cancellation timestamp

## Trading Fees

The system charges a **0.1% fee** on all settled orders:

- **Buy Orders**: Fee is deducted from the stock amount received
  - User pays for 100 shares but receives 99.9 shares (0.1 shares as fee)
  
- **Sell Orders**: Fee is deducted from the USD amount received  
  - User sells 100 shares but receives 99.9% of the USD value (0.1% as fee)

The fees are retained by the contract and not redistributed.

The order flow system integrates with:

1. **BucketStock Module**: For minting/burning stock tokens
   - `UserMintStock`: Add stock to user's holdings
   - `UserBurnStock`: Remove stock from user's holdings

2. **MockUSD Module**: For USD transfers
   - `Transfer`: Move USD between accounts

3. **Price Feed**: External price data via Polygon API
   - Updates `StockLastPrice` via cron jobs

## Error Handling

All operations return structured responses with success/error status:

- Input validation errors
- Authorization errors
- Price availability errors
- Order status errors
- Balance/stock availability errors (handled by external modules)

## Security Features

- Only order owners can settle/cancel their orders
- Only authorized processes can register stocks
- Price feed updates are validated
- All monetary calculations use integer arithmetic for precision

## Automatic Settlement

The cron handler (`Cron` action) performs:
1. Fetches latest prices for all registered stocks
2. Checks all pending limit orders
3. Automatically settles orders where price conditions are met

This ensures limit orders execute promptly when market conditions allow.
