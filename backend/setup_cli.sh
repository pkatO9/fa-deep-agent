#!/bin/bash
# To run the deep agents CLI, use the following command:
# source setup_cli.sh
# deepagents --model azure_openai:gpt-4.1

# Source this file to set up environment variables for Deep Agents CLI
# Usage: source setup_cli.sh

if [ -f .env ]; then
    # Load .env variables
    export $(grep -v '^#' .env | xargs)
    echo "Environment variables loaded from .env"
    
    # Check if necessary variables are set
    if [ -z "$AZURE_OPENAI_API_KEY" ] || [ -z "$AZURE_OPENAI_ENDPOINT" ]; then
        echo "Warning: AZURE_OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT is not set."
    fi
    
    # Set default model for CLI if not already set
    if [ ! -z "$AZURE_OPENAI_DEPLOYMENT_NAME" ]; then
        # The CLI expects a model string like 'azure_openai:<deployment_name>'
        export DEEP_AGENTS_MODEL="azure_openai:$AZURE_OPENAI_DEPLOYMENT_NAME"
        echo "CLI configured to use model: $DEEP_AGENTS_MODEL"
    fi
else
    echo "Error: .env file not found."
fi
