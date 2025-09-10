YieldBetRegistration = YieldBetRegistration or {}

Handlers.add('RegisterUser', 'RegisterUser', function(msg) 
    local wallet_address = msg.wallet_address
    local yeild_bet_account_process = msg.yield_bet_account_address
    
    if not wallet_address or type(wallet_address) ~= 'string' then
        return false, "Invalid wallet address"
    end
    if not yeild_bet_account_process or type(yeild_bet_account_process) ~= 'string' then
        return false, "Invalid yield bet account process address"
    end
    if YieldBetRegistration[wallet_address] then
        return false, "Wallet address already registered"
    end
    YieldBetRegistration[wallet_address] = yeild_bet_account_process
    return true
end)