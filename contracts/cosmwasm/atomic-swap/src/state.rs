use cosmwasm_schema::cw_serde;
use cosmwasm_std::{Addr, Coin, Uint128};
use cw_storage_plus::{Item, Map};

use crate::msg::SwapState;

#[cw_serde]
pub struct Config {
    pub admin: Addr,
    pub minimum_safety_deposit: Uint128,
    pub min_timelock_duration: u64,
    pub max_timelock_duration: u64,
    pub paused: bool,
}

#[cw_serde]
pub struct AtomicSwap {
    pub swap_id: String,
    pub initiator: Addr,
    pub participant: Addr,
    pub amount: Coin,
    pub hashlock: String,
    pub timelock: u64,
    pub state: SwapState,
    pub secret: Option<String>,
    pub ethereum_recipient: String,
    pub ethereum_chain_id: String,
    pub created_at: u64,
    pub completed_at: Option<u64>,
    pub safety_deposit: Uint128,
}

#[cw_serde]
pub struct SwapStats {
    pub total_swaps: u64,
    pub completed_swaps: u64,
    pub refunded_swaps: u64,
    pub total_volume: Vec<Coin>,
}

pub const CONFIG: Item<Config> = Item::new("config");
pub const SWAPS: Map<&str, AtomicSwap> = Map::new("swaps");
pub const SWAP_STATS: Item<SwapStats> = Item::new("swap_stats");

// Secondary indexes for efficient querying
pub const SWAPS_BY_INITIATOR: Map<(&str, &str), bool> = Map::new("swaps_by_initiator");
pub const SWAPS_BY_PARTICIPANT: Map<(&str, &str), bool> = Map::new("swaps_by_participant");
pub const SWAPS_BY_HASHLOCK: Map<(&str, &str), bool> = Map::new("swaps_by_hashlock");