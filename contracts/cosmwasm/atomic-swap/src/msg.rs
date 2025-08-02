use cosmwasm_schema::{cw_serde, QueryResponses};
use cosmwasm_std::{Addr, Coin, Uint128};

#[cw_serde]
pub struct InstantiateMsg {
    pub admin: Option<String>,
    pub minimum_safety_deposit: Option<Uint128>,
    pub min_timelock_duration: Option<u64>,
    pub max_timelock_duration: Option<u64>,
}

#[cw_serde]
pub enum ExecuteMsg {
    InitiateSwap {
        participant: String,
        amount: Coin,
        hashlock: String,
        timelock: u64,
        ethereum_recipient: String,
        ethereum_chain_id: String,
    },
    CompleteSwap {
        swap_id: String,
        secret: String,
    },
    RefundSwap {
        swap_id: String,
    },
    UpdateConfig {
        admin: Option<String>,
        minimum_safety_deposit: Option<Uint128>,
        min_timelock_duration: Option<u64>,
        max_timelock_duration: Option<u64>,
        paused: Option<bool>,
    },
    EmergencyRefund {
        swap_id: String,
    },
}

#[cw_serde]
#[derive(QueryResponses)]
pub enum QueryMsg {
    #[returns(ConfigResponse)]
    Config {},
    #[returns(SwapResponse)]
    Swap { swap_id: String },
    #[returns(SwapsResponse)]
    SwapsByInitiator { 
        initiator: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    #[returns(SwapsResponse)]
    SwapsByParticipant { 
        participant: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    #[returns(SwapsResponse)]
    SwapsByHashlock { 
        hashlock: String,
        start_after: Option<String>,
        limit: Option<u32>,
    },
    #[returns(SwapStatsResponse)]
    SwapStats {},
}

#[cw_serde]
pub struct ConfigResponse {
    pub admin: Addr,
    pub minimum_safety_deposit: Uint128,
    pub min_timelock_duration: u64,
    pub max_timelock_duration: u64,
    pub paused: bool,
}

#[cw_serde]
pub struct SwapResponse {
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
}

#[cw_serde]
pub struct SwapsResponse {
    pub swaps: Vec<SwapResponse>,
}

#[cw_serde]
pub struct SwapStatsResponse {
    pub total_swaps: u64,
    pub completed_swaps: u64,
    pub refunded_swaps: u64,
    pub active_swaps: u64,
    pub total_volume: Vec<Coin>,
}

#[cw_serde]
pub enum SwapState {
    Initiated,
    Completed,
    Refunded,
}

#[cw_serde]
pub struct MigrateMsg {}