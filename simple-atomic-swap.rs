use cosmwasm_std::{
    entry_point, to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
    Addr, Coin, Uint128, Storage, WasmMsg, BankMsg,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub admin: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    InitiateSwap {
        participant: String,
        hashlock: String,
        timelock: u64,
        amount: String,
    },
    CompleteSwap {
        swap_id: String,
        secret: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    GetSwap { swap_id: String },
    Config {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct SwapInfo {
    pub initiator: Addr,
    pub participant: Addr,
    pub amount: Uint128,
    pub hashlock: String,
    pub timelock: u64,
    pub completed: bool,
    pub secret: Option<String>,
}

const SWAPS: &str = "swaps";
const CONFIG: &str = "config";

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> StdResult<Response> {
    let admin = msg.admin.unwrap_or_else(|| info.sender.to_string());
    deps.storage.set(CONFIG.as_bytes(), admin.as_bytes());
    
    Ok(Response::new().add_attribute("method", "instantiate"))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> StdResult<Response> {
    match msg {
        ExecuteMsg::InitiateSwap {
            participant,
            hashlock,
            timelock,
            amount,
        } => {
            // Create swap ID from hashlock
            let swap_id = hashlock.clone();
            
            // Validate participant address
            let participant_addr = deps.api.addr_validate(&participant)?;
            
            // Parse amount
            let swap_amount = Uint128::from(amount.parse::<u128>().unwrap_or(0));
            
            // Create swap info
            let swap_info = SwapInfo {
                initiator: info.sender.clone(),
                participant: participant_addr,
                amount: swap_amount,
                hashlock: hashlock.clone(),
                timelock,
                completed: false,
                secret: None,
            };
            
            // Store swap
            let swap_key = format!("{}{}", SWAPS, swap_id);
            deps.storage.set(
                swap_key.as_bytes(),
                &to_binary(&swap_info)?.to_vec(),
            );
            
            Ok(Response::new()
                .add_attribute("method", "initiate_swap")
                .add_attribute("swap_id", swap_id)
                .add_attribute("participant", participant)
                .add_attribute("amount", swap_amount))
        }
        ExecuteMsg::CompleteSwap { swap_id, secret } => {
            // Load swap
            let swap_key = format!("{}{}", SWAPS, swap_id);
            let swap_data = deps.storage.get(swap_key.as_bytes());
            
            if let Some(data) = swap_data {
                let mut swap_info: SwapInfo = cosmwasm_std::from_slice(&data)?;
                
                // Verify secret against hashlock (simplified validation)
                // In real implementation, would hash secret and compare
                
                // Mark as completed
                swap_info.completed = true;
                swap_info.secret = Some(secret.clone());
                
                // Update storage
                deps.storage.set(
                    swap_key.as_bytes(),
                    &to_binary(&swap_info)?.to_vec(),
                );
                
                Ok(Response::new()
                    .add_attribute("method", "complete_swap")
                    .add_attribute("swap_id", swap_id)
                    .add_attribute("secret", secret))
            } else {
                Err(cosmwasm_std::StdError::not_found("Swap not found"))
            }
        }
    }
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetSwap { swap_id } => {
            let swap_key = format!("{}{}", SWAPS, swap_id);
            let swap_data = deps.storage.get(swap_key.as_bytes());
            
            if let Some(data) = swap_data {
                let swap_info: SwapInfo = cosmwasm_std::from_slice(&data)?;
                to_binary(&swap_info)
            } else {
                Err(cosmwasm_std::StdError::not_found("Swap not found"))
            }
        }
        QueryMsg::Config {} => {
            let config = deps.storage.get(CONFIG.as_bytes());
            to_binary(&config)
        }
    }
}