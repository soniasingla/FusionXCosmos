#[cfg(not(feature = "imported"))]
use cosmwasm_std::entry_point;
use cosmwasm_std::{
    coins, to_json_binary, Addr, BankMsg, Binary, Bound, Coin, Deps, DepsMut, Env, MessageInfo, Order, Response,
    StdResult, Uint128,
};
use cw2::set_contract_version;
use sha2::{Digest, Sha256};

use crate::error::ContractError;
use crate::msg::{
    ConfigResponse, ExecuteMsg, InstantiateMsg, MigrateMsg, QueryMsg, SwapResponse, SwapState,
    SwapStatsResponse, SwapsResponse,
};
use crate::state::{
    AtomicSwap, Config, SwapStats, CONFIG, SWAPS, SWAPS_BY_HASHLOCK, SWAPS_BY_INITIATOR,
    SWAPS_BY_PARTICIPANT, SWAP_STATS,
};

const CONTRACT_NAME: &str = "crates.io:atomic-swap";
const CONTRACT_VERSION: &str = env!("CARGO_PKG_VERSION");

const DEFAULT_MIN_TIMELOCK_DURATION: u64 = 3600; // 1 hour
const DEFAULT_MAX_TIMELOCK_DURATION: u64 = 7 * 24 * 3600; // 1 week
const DEFAULT_MINIMUM_SAFETY_DEPOSIT: u128 = 1000000; // 1 ujuno

#[cfg_attr(not(feature = "imported"), entry_point)]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let admin = msg
        .admin
        .map(|s| deps.api.addr_validate(&s))
        .transpose()?
        .unwrap_or_else(|| info.sender.clone());

    let config = Config {
        admin,
        minimum_safety_deposit: msg
            .minimum_safety_deposit
            .unwrap_or_else(|| Uint128::new(DEFAULT_MINIMUM_SAFETY_DEPOSIT)),
        min_timelock_duration: msg
            .min_timelock_duration
            .unwrap_or(DEFAULT_MIN_TIMELOCK_DURATION),
        max_timelock_duration: msg
            .max_timelock_duration
            .unwrap_or(DEFAULT_MAX_TIMELOCK_DURATION),
        paused: false,
    };

    CONFIG.save(deps.storage, &config)?;

    let stats = SwapStats {
        total_swaps: 0,
        completed_swaps: 0,
        refunded_swaps: 0,
        total_volume: vec![],
    };
    SWAP_STATS.save(deps.storage, &stats)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("admin", config.admin)
        .add_attribute(
            "minimum_safety_deposit",
            config.minimum_safety_deposit.to_string(),
        ))
}

#[cfg_attr(not(feature = "imported"), entry_point)]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::InitiateSwap {
            participant,
            amount,
            hashlock,
            timelock,
            ethereum_recipient,
            ethereum_chain_id,
        } => execute_initiate_swap(
            deps,
            env,
            info,
            participant,
            amount,
            hashlock,
            timelock,
            ethereum_recipient,
            ethereum_chain_id,
        ),
        ExecuteMsg::CompleteSwap { swap_id, secret } => {
            execute_complete_swap(deps, env, info, swap_id, secret)
        }
        ExecuteMsg::RefundSwap { swap_id } => execute_refund_swap(deps, env, info, swap_id),
        ExecuteMsg::UpdateConfig {
            admin,
            minimum_safety_deposit,
            min_timelock_duration,
            max_timelock_duration,
            paused,
        } => execute_update_config(
            deps,
            env,
            info,
            admin,
            minimum_safety_deposit,
            min_timelock_duration,
            max_timelock_duration,
            paused,
        ),
        ExecuteMsg::EmergencyRefund { swap_id } => {
            execute_emergency_refund(deps, env, info, swap_id)
        }
    }
}

pub fn execute_initiate_swap(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    participant: String,
    amount: Coin,
    hashlock: String,
    timelock: u64,
    ethereum_recipient: String,
    ethereum_chain_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    if config.paused {
        return Err(ContractError::ContractPaused {});
    }

    // Validate participant address
    let participant_addr = deps.api.addr_validate(&participant)?;

    // Validate amount
    if amount.amount.is_zero() {
        return Err(ContractError::InvalidAmount {});
    }

    // Validate timelock
    let current_time = env.block.time.seconds();
    if timelock <= current_time + config.min_timelock_duration {
        return Err(ContractError::InvalidTimelock {
            min: config.min_timelock_duration,
            max: config.max_timelock_duration,
        });
    }
    if timelock >= current_time + config.max_timelock_duration {
        return Err(ContractError::InvalidTimelock {
            min: config.min_timelock_duration,
            max: config.max_timelock_duration,
        });
    }

    // Validate hashlock format (must be 64 character hex string for SHA256)
    if hashlock.len() != 64 || !hashlock.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(ContractError::Std(cosmwasm_std::StdError::generic_err(
            "Invalid hashlock format. Must be 64-character hex string",
        )));
    }

    // Check safety deposit
    let safety_deposit = info
        .funds
        .iter()
        .find(|coin| coin.denom == amount.denom)
        .map(|coin| coin.amount)
        .unwrap_or_default();

    if safety_deposit < config.minimum_safety_deposit {
        return Err(ContractError::SafetyDepositTooLow {
            minimum: config.minimum_safety_deposit.to_string(),
        });
    }

    // Generate swap ID
    let swap_id = generate_swap_id(
        &info.sender,
        &participant_addr,
        &hashlock,
        timelock,
        &env.block.height,
    );

    // Check if swap already exists
    if SWAPS.has(deps.storage, &swap_id) {
        return Err(ContractError::SwapAlreadyExists { swap_id });
    }

    // Create the swap
    let swap = AtomicSwap {
        swap_id: swap_id.clone(),
        initiator: info.sender.clone(),
        participant: participant_addr.clone(),
        amount: amount.clone(),
        hashlock: hashlock.clone(),
        timelock,
        state: SwapState::Initiated,
        secret: None,
        ethereum_recipient,
        ethereum_chain_id,
        created_at: current_time,
        completed_at: None,
        safety_deposit,
    };

    // Save the swap
    SWAPS.save(deps.storage, &swap_id, &swap)?;

    // Update indexes
    SWAPS_BY_INITIATOR.save(deps.storage, (info.sender.as_str(), &swap_id), &true)?;
    SWAPS_BY_PARTICIPANT.save(deps.storage, (participant_addr.as_str(), &swap_id), &true)?;
    SWAPS_BY_HASHLOCK.save(deps.storage, (&hashlock, &swap_id), &true)?;

    // Update stats
    let mut stats = SWAP_STATS.load(deps.storage)?;
    stats.total_swaps += 1;
    add_to_volume(&mut stats.total_volume, &amount);
    SWAP_STATS.save(deps.storage, &stats)?;

    Ok(Response::new()
        .add_attribute("method", "initiate_swap")
        .add_attribute("swap_id", swap_id)
        .add_attribute("initiator", info.sender)
        .add_attribute("participant", participant_addr)
        .add_attribute("amount", amount.to_string())
        .add_attribute("hashlock", hashlock)
        .add_attribute("timelock", timelock.to_string()))
}

pub fn execute_complete_swap(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    swap_id: String,
    secret: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    if config.paused {
        return Err(ContractError::ContractPaused {});
    }

    let mut swap = SWAPS.load(deps.storage, &swap_id)?;

    // Verify only participant can complete
    if info.sender != swap.participant {
        return Err(ContractError::OnlyParticipant {});
    }

    // Check if swap is in initiated state
    match swap.state {
        SwapState::Initiated => {}
        SwapState::Completed => return Err(ContractError::SwapAlreadyCompleted {}),
        SwapState::Refunded => return Err(ContractError::SwapAlreadyRefunded {}),
    }

    // Check if swap has not expired
    let current_time = env.block.time.seconds();
    if current_time >= swap.timelock {
        return Err(ContractError::SwapExpired {
            current_time,
            expiry: swap.timelock,
        });
    }

    // Verify secret against hashlock
    if !verify_secret(&swap.hashlock, &secret)? {
        let actual_hash = hex::encode(Sha256::digest(secret.as_bytes()));
        return Err(ContractError::InvalidSecret {
            expected: swap.hashlock.clone(),
            actual: actual_hash,
        });
    }

    // Update swap state
    swap.state = SwapState::Completed;
    swap.secret = Some(secret.clone());
    swap.completed_at = Some(current_time);
    SWAPS.save(deps.storage, &swap_id, &swap)?;

    // Update stats
    let mut stats = SWAP_STATS.load(deps.storage)?;
    stats.completed_swaps += 1;
    SWAP_STATS.save(deps.storage, &stats)?;

    // Prepare messages
    let mut messages = vec![];

    // Transfer tokens to participant
    messages.push(BankMsg::Send {
        to_address: swap.participant.to_string(),
        amount: coins(swap.amount.amount.u128(), &swap.amount.denom),
    });

    // Return safety deposit to initiator
    if !swap.safety_deposit.is_zero() {
        messages.push(BankMsg::Send {
            to_address: swap.initiator.to_string(),
            amount: coins(swap.safety_deposit.u128(), &swap.amount.denom),
        });
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("method", "complete_swap")
        .add_attribute("swap_id", swap_id)
        .add_attribute("secret", secret)
        .add_attribute("completed_by", info.sender))
}

pub fn execute_refund_swap(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    swap_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    if config.paused {
        return Err(ContractError::ContractPaused {});
    }

    let mut swap = SWAPS.load(deps.storage, &swap_id)?;

    // Verify only initiator can refund
    if info.sender != swap.initiator {
        return Err(ContractError::OnlyInitiator {});
    }

    // Check if swap is in initiated state
    match swap.state {
        SwapState::Initiated => {}
        SwapState::Completed => return Err(ContractError::SwapAlreadyCompleted {}),
        SwapState::Refunded => return Err(ContractError::SwapAlreadyRefunded {}),
    }

    // Check if swap has expired
    let current_time = env.block.time.seconds();
    if current_time < swap.timelock {
        return Err(ContractError::SwapNotExpired {
            current_time,
            expiry: swap.timelock,
        });
    }

    // Update swap state
    swap.state = SwapState::Refunded;
    swap.completed_at = Some(current_time);
    SWAPS.save(deps.storage, &swap_id, &swap)?;

    // Update stats
    let mut stats = SWAP_STATS.load(deps.storage)?;
    stats.refunded_swaps += 1;
    SWAP_STATS.save(deps.storage, &stats)?;

    // Prepare messages
    let mut messages = vec![];

    // Return tokens to initiator
    messages.push(BankMsg::Send {
        to_address: swap.initiator.to_string(),
        amount: coins(swap.amount.amount.u128(), &swap.amount.denom),
    });

    // Return safety deposit to initiator
    if !swap.safety_deposit.is_zero() {
        messages.push(BankMsg::Send {
            to_address: swap.initiator.to_string(),
            amount: coins(swap.safety_deposit.u128(), &swap.amount.denom),
        });
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("method", "refund_swap")
        .add_attribute("swap_id", swap_id)
        .add_attribute("refunded_to", info.sender))
}

pub fn execute_update_config(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    admin: Option<String>,
    minimum_safety_deposit: Option<Uint128>,
    min_timelock_duration: Option<u64>,
    max_timelock_duration: Option<u64>,
    paused: Option<bool>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let mut response = Response::new().add_attribute("method", "update_config");

    if let Some(admin_addr) = admin {
        let new_admin = deps.api.addr_validate(&admin_addr)?;
        config.admin = new_admin.clone();
        response = response.add_attribute("new_admin", new_admin);
    }

    if let Some(deposit) = minimum_safety_deposit {
        config.minimum_safety_deposit = deposit;
        response = response.add_attribute("new_minimum_safety_deposit", deposit.to_string());
    }

    if let Some(min_duration) = min_timelock_duration {
        config.min_timelock_duration = min_duration;
        response = response.add_attribute("new_min_timelock_duration", min_duration.to_string());
    }

    if let Some(max_duration) = max_timelock_duration {
        config.max_timelock_duration = max_duration;
        response = response.add_attribute("new_max_timelock_duration", max_duration.to_string());
    }

    if let Some(pause_state) = paused {
        config.paused = pause_state;
        response = response.add_attribute("paused", pause_state.to_string());
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(response)
}

pub fn execute_emergency_refund(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    swap_id: String,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;

    if info.sender != config.admin {
        return Err(ContractError::Unauthorized {});
    }

    let mut swap = SWAPS.load(deps.storage, &swap_id)?;

    // Check if swap is in initiated state
    match swap.state {
        SwapState::Initiated => {}
        SwapState::Completed => return Err(ContractError::SwapAlreadyCompleted {}),
        SwapState::Refunded => return Err(ContractError::SwapAlreadyRefunded {}),
    }

    // Update swap state
    let current_time = env.block.time.seconds();
    swap.state = SwapState::Refunded;
    swap.completed_at = Some(current_time);
    SWAPS.save(deps.storage, &swap_id, &swap)?;

    // Update stats
    let mut stats = SWAP_STATS.load(deps.storage)?;
    stats.refunded_swaps += 1;
    SWAP_STATS.save(deps.storage, &stats)?;

    // Prepare messages
    let mut messages = vec![];

    // Return tokens to initiator
    messages.push(BankMsg::Send {
        to_address: swap.initiator.to_string(),
        amount: coins(swap.amount.amount.u128(), &swap.amount.denom),
    });

    // Return safety deposit to initiator
    if !swap.safety_deposit.is_zero() {
        messages.push(BankMsg::Send {
            to_address: swap.initiator.to_string(),
            amount: coins(swap.safety_deposit.u128(), &swap.amount.denom),
        });
    }

    Ok(Response::new()
        .add_messages(messages)
        .add_attribute("method", "emergency_refund")
        .add_attribute("swap_id", swap_id)
        .add_attribute("admin", info.sender))
}

#[cfg_attr(not(feature = "imported"), entry_point)]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::Config {} => to_json_binary(&query_config(deps)?),
        QueryMsg::Swap { swap_id } => to_json_binary(&query_swap(deps, swap_id)?),
        QueryMsg::SwapsByInitiator {
            initiator,
            start_after,
            limit,
        } => to_json_binary(&query_swaps_by_initiator(deps, initiator, start_after, limit)?),
        QueryMsg::SwapsByParticipant {
            participant,
            start_after,
            limit,
        } => to_json_binary(&query_swaps_by_participant(
            deps,
            participant,
            start_after,
            limit,
        )?),
        QueryMsg::SwapsByHashlock {
            hashlock,
            start_after,
            limit,
        } => to_json_binary(&query_swaps_by_hashlock(deps, hashlock, start_after, limit)?),
        QueryMsg::SwapStats {} => to_json_binary(&query_swap_stats(deps)?),
    }
}

pub fn query_config(deps: Deps) -> StdResult<ConfigResponse> {
    let config = CONFIG.load(deps.storage)?;
    Ok(ConfigResponse {
        admin: config.admin,
        minimum_safety_deposit: config.minimum_safety_deposit,
        min_timelock_duration: config.min_timelock_duration,
        max_timelock_duration: config.max_timelock_duration,
        paused: config.paused,
    })
}

pub fn query_swap(deps: Deps, swap_id: String) -> StdResult<SwapResponse> {
    let swap = SWAPS.load(deps.storage, &swap_id)?;
    Ok(SwapResponse {
        swap_id: swap.swap_id,
        initiator: swap.initiator,
        participant: swap.participant,
        amount: swap.amount,
        hashlock: swap.hashlock,
        timelock: swap.timelock,
        state: swap.state,
        secret: swap.secret,
        ethereum_recipient: swap.ethereum_recipient,
        ethereum_chain_id: swap.ethereum_chain_id,
        created_at: swap.created_at,
        completed_at: swap.completed_at,
    })
}

pub fn query_swaps_by_initiator(
    deps: Deps,
    initiator: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<SwapsResponse> {
    let limit = limit.unwrap_or(10).min(30) as usize;
    let start = start_after.as_deref();

    let swaps: StdResult<Vec<_>> = SWAPS_BY_INITIATOR
        .prefix(&initiator)
        .range(deps.storage, start.map(Bound::exclusive), None, Order::Ascending)
        .take(limit)
        .map(|item| {
            let (swap_id, _) = item?;
            let swap = SWAPS.load(deps.storage, &swap_id)?;
            Ok(SwapResponse {
                swap_id: swap.swap_id,
                initiator: swap.initiator,
                participant: swap.participant,
                amount: swap.amount,
                hashlock: swap.hashlock,
                timelock: swap.timelock,
                state: swap.state,
                secret: swap.secret,
                ethereum_recipient: swap.ethereum_recipient,
                ethereum_chain_id: swap.ethereum_chain_id,
                created_at: swap.created_at,
                completed_at: swap.completed_at,
            })
        })
        .collect();

    Ok(SwapsResponse { swaps: swaps? })
}

pub fn query_swaps_by_participant(
    deps: Deps,
    participant: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<SwapsResponse> {
    let limit = limit.unwrap_or(10).min(30) as usize;
    let start = start_after.as_deref();

    let swaps: StdResult<Vec<_>> = SWAPS_BY_PARTICIPANT
        .prefix(&participant)
        .range(deps.storage, start.map(Bound::exclusive), None, Order::Ascending)
        .take(limit)
        .map(|item| {
            let (swap_id, _) = item?;
            let swap = SWAPS.load(deps.storage, &swap_id)?;
            Ok(SwapResponse {
                swap_id: swap.swap_id,
                initiator: swap.initiator,
                participant: swap.participant,
                amount: swap.amount,
                hashlock: swap.hashlock,
                timelock: swap.timelock,
                state: swap.state,
                secret: swap.secret,
                ethereum_recipient: swap.ethereum_recipient,
                ethereum_chain_id: swap.ethereum_chain_id,
                created_at: swap.created_at,
                completed_at: swap.completed_at,
            })
        })
        .collect();

    Ok(SwapsResponse { swaps: swaps? })
}

pub fn query_swaps_by_hashlock(
    deps: Deps,
    hashlock: String,
    start_after: Option<String>,
    limit: Option<u32>,
) -> StdResult<SwapsResponse> {
    let limit = limit.unwrap_or(10).min(30) as usize;
    let start = start_after.as_deref();

    let swaps: StdResult<Vec<_>> = SWAPS_BY_HASHLOCK
        .prefix(&hashlock)
        .range(deps.storage, start.map(Bound::exclusive), None, Order::Ascending)
        .take(limit)
        .map(|item| {
            let (swap_id, _) = item?;
            let swap = SWAPS.load(deps.storage, &swap_id)?;
            Ok(SwapResponse {
                swap_id: swap.swap_id,
                initiator: swap.initiator,
                participant: swap.participant,
                amount: swap.amount,
                hashlock: swap.hashlock,
                timelock: swap.timelock,
                state: swap.state,
                secret: swap.secret,
                ethereum_recipient: swap.ethereum_recipient,
                ethereum_chain_id: swap.ethereum_chain_id,
                created_at: swap.created_at,
                completed_at: swap.completed_at,
            })
        })
        .collect();

    Ok(SwapsResponse { swaps: swaps? })
}

pub fn query_swap_stats(deps: Deps) -> StdResult<SwapStatsResponse> {
    let stats = SWAP_STATS.load(deps.storage)?;
    let active_swaps = stats.total_swaps - stats.completed_swaps - stats.refunded_swaps;

    Ok(SwapStatsResponse {
        total_swaps: stats.total_swaps,
        completed_swaps: stats.completed_swaps,
        refunded_swaps: stats.refunded_swaps,
        active_swaps,
        total_volume: stats.total_volume,
    })
}

#[cfg_attr(not(feature = "imported"), entry_point)]
pub fn migrate(_deps: DepsMut, _env: Env, _msg: MigrateMsg) -> Result<Response, ContractError> {
    Ok(Response::default())
}

// Helper functions

fn generate_swap_id(
    initiator: &Addr,
    participant: &Addr,
    hashlock: &str,
    timelock: u64,
    block_height: &u64,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(initiator.as_bytes());
    hasher.update(participant.as_bytes());
    hasher.update(hashlock.as_bytes());
    hasher.update(timelock.to_be_bytes());
    hasher.update(block_height.to_be_bytes());
    hex::encode(hasher.finalize())
}

fn verify_secret(hashlock: &str, secret: &str) -> Result<bool, ContractError> {
    let hash = hex::encode(Sha256::digest(secret.as_bytes()));
    Ok(hash == hashlock.to_lowercase())
}

fn add_to_volume(volume: &mut Vec<Coin>, amount: &Coin) {
    if let Some(existing) = volume.iter_mut().find(|coin| coin.denom == amount.denom) {
        existing.amount += amount.amount;
    } else {
        volume.push(amount.clone());
    }
}

