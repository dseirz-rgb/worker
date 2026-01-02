#!/bin/bash

# =============================================================================
# Vercel Deployment Verification Script
# =============================================================================
# Description: Verify Vercel deployment status and health
# Usage: bash verify-vercel.sh [deployment-url]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success") echo -e "${GREEN}✅ $message${NC}" ;;
        "error") echo -e "${RED}❌ $message${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $message${NC}" ;;
        "info") echo -e "${BLUE}ℹ️  $message${NC}" ;;
    esac
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Check if vercel CLI is installed
check_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_status "error" "Vercel CLI is not installed"
        echo "Install with: npm i -g vercel"
        exit 1
    fi
    print_status "success" "Vercel CLI found"
}

# Get latest deployment URL
get_latest_deployment() {
    local deployment_url=$1
    
    if [ -z "$deployment_url" ]; then
        print_status "info" "No deployment URL provided, fetching latest..."
        deployment_url=$(vercel ls --limit 1 2>/dev/null | tail -n 1 | awk '{print $2}')
        
        if [ -z "$deployment_url" ]; then
            print_status "error" "Could not fetch latest deployment"
            exit 1
        fi
    fi
    
    echo "$deployment_url"
}

# Check deployment status
check_deployment_status() {
    local deployment_url=$1
    
    print_header "Deployment Status Check"
    
    # Get deployment info
    local status=$(vercel inspect "$deployment_url" 2>/dev/null | grep -i "state" | head -1 || echo "")
    
    if [[ "$status" == *"READY"* ]]; then
        print_status "success" "Deployment is READY"
        return 0
    elif [[ "$status" == *"ERROR"* ]]; then
        print_status "error" "Deployment has ERROR"
        return 1
    elif [[ "$status" == *"BUILDING"* ]]; then
        print_status "warning" "Deployment is still BUILDING"
        return 2
    else
        print_status "warning" "Unknown deployment status: $status"
        return 3
    fi
}

# Check health endpoint
check_health_endpoint() {
    local base_url=$1
    local health_path=${2:-"/api/health"}
    
    print_header "Health Endpoint Check"
    
    # Ensure URL has protocol
    if [[ ! "$base_url" =~ ^https?:// ]]; then
        base_url="https://$base_url"
    fi
    
    local health_url="${base_url}${health_path}"
    print_status "info" "Checking: $health_url"
    
    # Make request with timeout
    local response
    local http_code
    
    response=$(curl -s --max-time 30 -w "\n%{http_code}" "$health_url" 2>/dev/null)
    http_code=$(echo "$response" | tail -n 1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "200" ]; then
        print_status "success" "Health check passed (HTTP $http_code)"
        echo "Response: $body" | head -c 500
        echo ""
        return 0
    elif [ "$http_code" == "000" ]; then
        print_status "error" "Health check failed: Connection timeout or refused"
        return 1
    else
        print_status "error" "Health check failed (HTTP $http_code)"
        echo "Response: $body" | head -c 500
        echo ""
        return 1
    fi
}

# Check environment variables
check_env_variables() {
    print_header "Environment Variables Check"
    
    # Get Vercel env vars
    local vercel_envs=$(vercel env ls 2>/dev/null | grep -E "^[A-Z]" | awk '{print $1}' | sort)
    
    if [ -z "$vercel_envs" ]; then
        print_status "warning" "No environment variables found or not logged in"
        return 1
    fi
    
    print_status "info" "Vercel environment variables:"
    echo "$vercel_envs" | while read -r var; do
        echo "  - $var"
    done
    
    # Check for common required variables
    local required_vars=("DATABASE_URL" "NEXTAUTH_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! echo "$vercel_envs" | grep -q "^$var$"; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status "warning" "Potentially missing variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
    else
        print_status "success" "All common required variables present"
    fi
    
    return 0
}

# Check local vs Vercel env sync
check_env_sync() {
    print_header "Environment Sync Check"
    
    if [ ! -f ".env" ] && [ ! -f ".env.local" ]; then
        print_status "warning" "No local .env file found"
        return 1
    fi
    
    local env_file=".env"
    [ -f ".env.local" ] && env_file=".env.local"
    
    # Get local env var names
    local local_envs=$(grep -E "^[A-Z]" "$env_file" 2>/dev/null | cut -d= -f1 | sort)
    
    # Get Vercel env var names
    local vercel_envs=$(vercel env ls 2>/dev/null | grep -E "^[A-Z]" | awk '{print $1}' | sort)
    
    # Compare
    local only_local=$(comm -23 <(echo "$local_envs") <(echo "$vercel_envs") 2>/dev/null)
    local only_vercel=$(comm -13 <(echo "$local_envs") <(echo "$vercel_envs") 2>/dev/null)
    
    if [ -n "$only_local" ]; then
        print_status "warning" "Variables only in local .env (not in Vercel):"
        echo "$only_local" | while read -r var; do
            [ -n "$var" ] && echo "  - $var"
        done
    fi
    
    if [ -n "$only_vercel" ]; then
        print_status "info" "Variables only in Vercel (not in local .env):"
        echo "$only_vercel" | while read -r var; do
            [ -n "$var" ] && echo "  - $var"
        done
    fi
    
    if [ -z "$only_local" ] && [ -z "$only_vercel" ]; then
        print_status "success" "Environment variables are in sync"
    fi
    
    return 0
}

# Check recent deployments
check_recent_deployments() {
    print_header "Recent Deployments"
    
    vercel ls --limit 5 2>/dev/null || {
        print_status "error" "Failed to fetch deployments"
        return 1
    }
    
    return 0
}

# Main function
main() {
    local deployment_url=$1
    local errors=0
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       Vercel Deployment Verification Script               ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Check prerequisites
    check_vercel_cli || exit 1
    
    # Get deployment URL
    deployment_url=$(get_latest_deployment "$deployment_url")
    print_status "info" "Verifying deployment: $deployment_url"
    
    # Run checks
    check_deployment_status "$deployment_url" || ((errors++))
    check_health_endpoint "$deployment_url" || ((errors++))
    check_env_variables || ((errors++))
    check_env_sync || ((errors++))
    check_recent_deployments || ((errors++))
    
    # Summary
    print_header "Verification Summary"
    
    if [ $errors -eq 0 ]; then
        print_status "success" "All checks passed!"
        echo ""
        exit 0
    else
        print_status "error" "$errors check(s) failed or had warnings"
        echo ""
        exit 1
    fi
}

# Run main function with all arguments
main "$@"
