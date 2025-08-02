use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Swap already exists with ID: {swap_id}")]
    SwapAlreadyExists { swap_id: String },

    #[error("Swap not found with ID: {swap_id}")]
    SwapNotFound { swap_id: String },

    #[error("Swap already completed")]
    SwapAlreadyCompleted {},

    #[error("Swap already refunded")]
    SwapAlreadyRefunded {},

    #[error("Swap not expired yet. Current time: {current_time}, expiry: {expiry}")]
    SwapNotExpired { current_time: u64, expiry: u64 },

    #[error("Swap expired. Current time: {current_time}, expiry: {expiry}")]
    SwapExpired { current_time: u64, expiry: u64 },

    #[error("Invalid secret. Expected hash: {expected}, got hash: {actual}")]
    InvalidSecret { expected: String, actual: String },

    #[error("Invalid timelock. Must be between {min} and {max} seconds from now")]
    InvalidTimelock { min: u64, max: u64 },

    #[error("Insufficient funds. Required: {required}, available: {available}")]
    InsufficientFunds { required: String, available: String },

    #[error("Only swap initiator can perform this action")]
    OnlyInitiator {},

    #[error("Only swap participant can perform this action")]
    OnlyParticipant {},

    #[error("Invalid amount. Must be greater than 0")]
    InvalidAmount {},

    #[error("Safety deposit too low. Minimum required: {minimum}")]
    SafetyDepositTooLow { minimum: String },

    #[error("Contract is paused")]
    ContractPaused {},
}