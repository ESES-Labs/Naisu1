//! Programmable Transaction Block (PTB) builder for Sui

use serde::{Deserialize, Serialize};

/// PTB command types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "PascalCase")]
pub enum PtbCommand {
    /// Move call
    MoveCall(MoveCallCommand),
    /// Transfer objects
    TransferObjects(TransferObjectsCommand),
    /// Split coins
    SplitCoins(SplitCoinsCommand),
    /// Merge coins
    MergeCoins(MergeCoinsCommand),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveCallCommand {
    pub package: String,
    pub module: String,
    pub function: String,
    pub type_arguments: Vec<String>,
    pub arguments: Vec<PtbArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferObjectsCommand {
    pub objects: Vec<PtbArgument>,
    pub address: PtbArgument,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SplitCoinsCommand {
    pub coin: PtbArgument,
    pub amounts: Vec<PtbArgument>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergeCoinsCommand {
    pub destination: PtbArgument,
    pub sources: Vec<PtbArgument>,
}

/// PTB argument types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "PascalCase")]
pub enum PtbArgument {
    /// Gas coin
    GasCoin,
    /// Input object/value
    Input { index: u16 },
    /// Result from previous command
    Result { index: u16 },
    /// Nested result
    NestedResult { index: u16, result_index: u16 },
}

/// PTB builder
#[derive(Debug, Default)]
pub struct PtbBuilder {
    commands: Vec<PtbCommand>,
    inputs: Vec<PtbInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum PtbInput {
    /// Object reference
    Object { object_id: String, version: u64, digest: String },
    /// Pure value (serialized)
    Pure { value: Vec<u8> },
    /// Shared object
    SharedObject { object_id: String, initial_shared_version: u64, mutable: bool },
}

impl PtbBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    /// Add an input and return its index
    pub fn add_input(&mut self, input: PtbInput) -> PtbArgument {
        let index = self.inputs.len() as u16;
        self.inputs.push(input);
        PtbArgument::Input { index }
    }

    /// Add a pure value input
    pub fn add_pure<T: Serialize>(&mut self, value: &T) -> PtbArgument {
        let bytes = bcs_serialize(value);
        self.add_input(PtbInput::Pure { value: bytes })
    }

    /// Add an object input
    pub fn add_object(&mut self, object_id: &str, version: u64, digest: &str) -> PtbArgument {
        self.add_input(PtbInput::Object {
            object_id: object_id.to_string(),
            version,
            digest: digest.to_string(),
        })
    }

    /// Add a shared object input
    pub fn add_shared_object(&mut self, object_id: &str, initial_version: u64, mutable: bool) -> PtbArgument {
        self.add_input(PtbInput::SharedObject {
            object_id: object_id.to_string(),
            initial_shared_version: initial_version,
            mutable,
        })
    }

    /// Add a Move call command
    pub fn move_call(
        &mut self,
        package: &str,
        module: &str,
        function: &str,
        type_args: Vec<String>,
        args: Vec<PtbArgument>,
    ) -> PtbArgument {
        let index = self.commands.len() as u16;
        self.commands.push(PtbCommand::MoveCall(MoveCallCommand {
            package: package.to_string(),
            module: module.to_string(),
            function: function.to_string(),
            type_arguments: type_args,
            arguments: args,
        }));
        PtbArgument::Result { index }
    }

    /// Add a transfer objects command
    pub fn transfer_objects(&mut self, objects: Vec<PtbArgument>, address: PtbArgument) {
        self.commands.push(PtbCommand::TransferObjects(TransferObjectsCommand {
            objects,
            address,
        }));
    }

    /// Add a split coins command
    pub fn split_coins(&mut self, coin: PtbArgument, amounts: Vec<PtbArgument>) -> PtbArgument {
        let index = self.commands.len() as u16;
        self.commands.push(PtbCommand::SplitCoins(SplitCoinsCommand {
            coin,
            amounts,
        }));
        PtbArgument::Result { index }
    }

    /// Add a merge coins command
    pub fn merge_coins(&mut self, destination: PtbArgument, sources: Vec<PtbArgument>) {
        self.commands.push(PtbCommand::MergeCoins(MergeCoinsCommand {
            destination,
            sources,
        }));
    }

    /// Build the PTB
    pub fn build(self) -> ProgrammableTransactionBlock {
        ProgrammableTransactionBlock {
            inputs: self.inputs,
            commands: self.commands,
        }
    }
}

/// Complete PTB structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgrammableTransactionBlock {
    pub inputs: Vec<PtbInput>,
    pub commands: Vec<PtbCommand>,
}

/// Simple BCS serialization (placeholder - use actual bcs crate in production)
fn bcs_serialize<T: Serialize>(_value: &T) -> Vec<u8> {
    // TODO: Use proper BCS serialization
    // For MVP, this is a placeholder
    vec![]
}
