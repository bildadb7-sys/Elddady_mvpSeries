
export const LIMITER_LUA_SCRIPT = `
-- Token Bucket Algorithm
-- KEYS[1]: rate_limit_key (e.g., rate:ip:127.0.0.1)
-- ARGV[1]: capacity (max tokens)
-- ARGV[2]: refill_rate (tokens per second)
-- ARGV[3]: current_timestamp (unix seconds)
-- ARGV[4]: cost (tokens required for this request)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])

-- Retrieve current state (tokens and last_refill timestamp)
local state = redis.call("HMGET", key, "tokens", "last_refill")
local current_tokens = tonumber(state[1])
local last_refill = tonumber(state[2])

-- Initialize if request is new or key expired
if current_tokens == nil then
    current_tokens = capacity
    last_refill = now
end

-- Calculate refill based on time elapsed
local delta = math.max(0, now - last_refill)
local tokens_to_add = delta * rate
local new_tokens = math.min(capacity, current_tokens + tokens_to_add)

-- Check if enough tokens exist
if new_tokens >= cost then
    -- Deduct tokens and update state
    local remaining = new_tokens - cost
    redis.call("HMSET", key, "tokens", remaining, "last_refill", now)
    -- Refresh expiry (e.g., 1 hour) to clean up stale keys
    redis.call("EXPIRE", key, 3600)
    return 1 -- Allowed
else
    return 0 -- Blocked
end
`;
