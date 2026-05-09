#!/bin/bash

set -e

echo "🚀 JobHunter Pro 部署脚本"
echo "=========================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查 Docker 是否安装
check_docker() {
    log_info "检查 Docker 安装..."
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装。请先安装 Docker: https://docs.docker.com/get-docker/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装。请先安装 Docker Compose: https://docs.docker.com/compose/install/"
        exit 1
    fi
    
    log_success "Docker 和 Docker Compose 已安装"
}

# 创建必要的目录
create_directories() {
    log_info "创建必要的目录..."
    
    directories=(
        "data"
        "logs"
        "sessions"
        "cookies"
        "nginx/ssl"
        "nginx/conf.d"
    )
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            log_info "创建目录: $dir"
        fi
    done
    
    # 设置权限
    chmod -R 755 data logs sessions cookies
    
    log_success "目录创建完成"
}

# 复制环境变量文件
setup_env() {
    log_info "配置环境变量..."
    
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_warning "请编辑 .env 文件配置您的凭证"
            log_warning "特别是 BOSS_PHONE 和 BOSS_PASSWORD"
        fi
    fi
    
    log_success "环境变量配置完成"
}

# 构建 Docker 镜像
build_images() {
    log_info "构建 Docker 镜像..."
    
    docker-compose build --no-cache
    
    log_success "镜像构建完成"
}

# 启动服务
start_services() {
    log_info "启动服务..."
    
    docker-compose up -d
    
    # 等待服务启动
    sleep 10
    
    # 检查服务状态
    if docker-compose ps | grep -q "Up"; then
        log_success "服务启动成功！"
    else
        log_error "服务启动失败，请检查日志"
        docker-compose logs
        exit 1
    fi
}

# 检查健康状态
check_health() {
    log_info "检查服务健康状态..."
    
    max_attempts=30
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            log_success "服务健康检查通过"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "健康检查超时"
    return 1
}

# 显示服务信息
show_info() {
    echo ""
    echo "========================================="
    echo "🎉 JobHunter Pro 部署完成！"
    echo "========================================="
    echo ""
    echo "📍 访问地址:"
    echo "   - Web UI: http://localhost"
    echo "   - API:    http://localhost/api"
    echo "   - WebSocket: ws://localhost/ws"
    echo ""
    echo "🔧 管理命令:"
    echo "   - 查看日志:   docker-compose logs -f"
    echo "   - 停止服务:   docker-compose down"
    echo "   - 重启服务:   docker-compose restart"
    echo "   - 查看状态:   docker-compose ps"
    echo ""
    echo "📊 健康检查:"
    echo "   curl http://localhost:3000/health"
    echo ""
}

# 主函数
main() {
    echo ""
    log_info "开始部署 JobHunter Pro..."
    echo ""
    
    check_docker
    create_directories
    setup_env
    build_images
    start_services
    
    if check_health; then
        show_info
        log_success "部署成功！"
    else
        log_error "部署失败，请检查配置"
        exit 1
    fi
}

# 根据参数执行不同操作
case "${1:-deploy}" in
    deploy)
        main
        ;;
    start)
        docker-compose up -d
        log_success "服务已启动"
        ;;
    stop)
        docker-compose down
        log_success "服务已停止"
        ;;
    restart)
        docker-compose restart
        log_success "服务已重启"
        ;;
    logs)
        docker-compose logs -f
        ;;
    status)
        docker-compose ps
        ;;
    rebuild)
        docker-compose build --no-cache
        docker-compose up -d
        ;;
    clean)
        log_warning "清理所有数据和容器..."
        docker-compose down -v
        rm -rf data/* logs/* sessions/* cookies/*
        log_success "清理完成"
        ;;
    *)
        echo "用法: $0 {deploy|start|stop|restart|logs|status|rebuild|clean}"
        echo ""
        echo "命令说明:"
        echo "  deploy   - 完整部署应用 (默认)"
        echo "  start    - 启动服务"
        echo "  stop     - 停止服务"
        echo "  restart  - 重启服务"
        echo "  logs     - 查看日志"
        echo "  status   - 查看服务状态"
        echo "  rebuild  - 重新构建并部署"
        echo "  clean    - 清理所有数据"
        exit 1
        ;;
esac
