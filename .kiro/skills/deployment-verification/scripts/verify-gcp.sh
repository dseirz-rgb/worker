#!/bin/bash

# =============================================================================
# GCP Cloud Run Deployment Verification Script
# =============================================================================
# Description: Verify GCP Cloud Run deployment status and health
# Usage: bash verify-gcp.sh <service-name> [region]
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default region
DEFAULT_REGION="us-central1"

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

# Check if gcloud CLI is installed and authenticated
check_gcloud_cli() {
    if ! command -v gcloud &> /dev/null; then
        print_status "error" "gcloud CLI is not installed"
        echo "Install from: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    print_status "success" "gcloud CLI found"
    
    # Check authentication
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | head -1 | grep -q "@"; then
        print_status "error" "Not authenticated with gcloud"
        echo "Run: gcloud auth login"
        exit 1
    fi
    print_status "success" "gcloud authenticated"
}

# Get service URL
get_service_url() {
    local service_name=$1
    local region=$2
    
    local url=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="value(status.url)" 2>/dev/null)
    
    if [ -z "$url" ]; then
        print_status "error" "Could not get service URL"
        return 1
    fi
    
    echo "$url"
}

# Check service status
check_service_status() {
    local service_name=$1
    local region=$2
    
    print_header "Service Status Check"
    
    # Get service details
    local service_info=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="yaml(status.conditions)" 2>/dev/null)
    
    if [ -z "$service_info" ]; then
        print_status "error" "Service not found: $service_name in $region"
        return 1
    fi
    
    # Check if service is ready
    if echo "$service_info" | grep -q "status: 'True'"; then
        print_status "success" "Service is READY"
        
        # Show service URL
        local url=$(get_service_url "$service_name" "$region")
        print_status "info" "Service URL: $url"
        return 0
    else
        print_status "error" "Service is NOT READY"
        echo "$service_info"
        return 1
    fi
}

# Check latest revision
check_latest_revision() {
    local service_name=$1
    local region=$2
    
    print_header "Latest Revision Check"
    
    # Get revisions
    local revisions=$(gcloud run revisions list \
        --service="$service_name" \
        --region="$region" \
        --limit=5 \
        --format="table(REVISION,ACTIVE,DEPLOYED,STATUS)" 2>/dev/null)
    
    if [ -z "$revisions" ]; then
        print_status "error" "Could not fetch revisions"
        return 1
    fi
    
    echo "$revisions"
    
    # Check if latest revision is serving
    local latest_status=$(gcloud run revisions list \
        --service="$service_name" \
        --region="$region" \
        --limit=1 \
        --format="value(status.conditions[0].status)" 2>/dev/null)
    
    if [ "$latest_status" == "True" ]; then
        print_status "success" "Latest revision is healthy"
        return 0
    else
        print_status "error" "Latest revision has issues"
        return 1
    fi
}

# Check health endpoint
check_health_endpoint() {
    local service_url=$1
    local health_path=${2:-"/api/health"}
    
    print_header "Health Endpoint Check"
    
    local health_url="${service_url}${health_path}"
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

# Check environment variables (secrets)
check_env_variables() {
    local service_name=$1
    local region=$2
    
    print_header "Environment Variables Check"
    
    # Get env vars from service
    local env_vars=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="yaml(spec.template.spec.containers[0].env)" 2>/dev/null)
    
    if [ -z "$env_vars" ] || [ "$env_vars" == "null" ]; then
        print_status "warning" "No environment variables configured"
        return 1
    fi
    
    print_status "info" "Configured environment variables:"
    echo "$env_vars" | grep -E "name:" | sed 's/.*name: /  - /'
    
    return 0
}

# Check recent logs
check_recent_logs() {
    local service_name=$1
    local region=$2
    
    print_header "Recent Logs (last 10 entries)"
    
    gcloud logging read \
        "resource.type=cloud_run_revision AND resource.labels.service_name=$service_name" \
        --limit=10 \
        --format="table(timestamp,severity,textPayload)" 2>/dev/null || {
        print_status "warning" "Could not fetch logs"
        return 1
    }
    
    return 0
}

# Check metrics
check_metrics() {
    local service_name=$1
    local region=$2
    
    print_header "Service Metrics Summary"
    
    # Get container instance count
    local instance_count=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="value(status.traffic[0].percent)" 2>/dev/null)
    
    print_status "info" "Traffic allocation: ${instance_count:-100}%"
    
    # Get resource limits
    local memory=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="value(spec.template.spec.containers[0].resources.limits.memory)" 2>/dev/null)
    
    local cpu=$(gcloud run services describe "$service_name" \
        --region="$region" \
        --format="value(spec.template.spec.containers[0].resources.limits.cpu)" 2>/dev/null)
    
    print_status "info" "Memory limit: ${memory:-not set}"
    print_status "info" "CPU limit: ${cpu:-not set}"
    
    return 0
}

# Check IAM permissions
check_iam() {
    local service_name=$1
    local region=$2
    
    print_header "IAM Configuration"
    
    # Check if service allows unauthenticated access
    local iam_policy=$(gcloud run services get-iam-policy "$service_name" \
        --region="$region" \
        --format="yaml" 2>/dev/null)
    
    if echo "$iam_policy" | grep -q "allUsers"; then
        print_status "info" "Service allows unauthenticated access (public)"
    else
        print_status "info" "Service requires authentication"
    fi
    
    return 0
}

# Usage help
show_usage() {
    echo "Usage: $0 <service-name> [region]"
    echo ""
    echo "Arguments:"
    echo "  service-name  Name of the Cloud Run service"
    echo "  region        GCP region (default: $DEFAULT_REGION)"
    echo ""
    echo "Examples:"
    echo "  $0 my-api"
    echo "  $0 my-api us-east1"
    echo ""
}

# Main function
main() {
    local service_name=$1
    local region=${2:-$DEFAULT_REGION}
    local errors=0
    
    # Check arguments
    if [ -z "$service_name" ]; then
        print_status "error" "Service name is required"
        show_usage
        exit 1
    fi
    
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     GCP Cloud Run Deployment Verification Script          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    print_status "info" "Service: $service_name"
    print_status "info" "Region: $region"
    
    # Check prerequisites
    check_gcloud_cli || exit 1
    
    # Run checks
    check_service_status "$service_name" "$region" || ((errors++))
    check_latest_revision "$service_name" "$region" || ((errors++))
    
    # Get service URL for health check
    local service_url=$(get_service_url "$service_name" "$region")
    if [ -n "$service_url" ]; then
        check_health_endpoint "$service_url" || ((errors++))
    fi
    
    check_env_variables "$service_name" "$region" || ((errors++))
    check_metrics "$service_name" "$region" || ((errors++))
    check_iam "$service_name" "$region" || ((errors++))
    check_recent_logs "$service_name" "$region" || ((errors++))
    
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
