#!/usr/bin/env bash
#
# Teacher Box installer (ADR-0032): ready images, no source code or build on the server.
#
#   curl -fsSL https://raw.githubusercontent.com/verhoturkin/teacher-box/main/scripts/install.sh | sudo bash
#
# Asks for the domain, the time zone and whether to enable calls; writes .env (secrets generated), downloads
# compose.yaml into /opt/teacher-box, installs the "teacherbox" command, starts the portal and prints the address,
# the login and the password. Run it again to update an existing installation (.env is kept).
#
# Options (all optional; without a terminal or with --yes the defaults are used):
#   --domain NAME      domain for HTTPS through the built-in Caddy (empty: plain HTTP on port 8080)
#   --timezone ZONE    time zone of the teacher (default Europe/Moscow)
#   --port PORT        host port of the portal (default 8080; with a domain only on 127.0.0.1)
#   --calls | --no-calls   built-in calls (LiveKit), on by default
#   --version TAG      image version (default latest)
#   --dir DIR          installation directory (default /opt/teacher-box)
#   --bin DIR          where the "teacherbox" command goes (default /usr/local/bin)
#   --ref REF          branch or tag of the repository to download the files from (default main)
#   --source DIR       take the files from a local clone instead of downloading them
#   --no-start         write the files only (checks, CI)
#   --no-pull          use the images already on this machine (checks before a release)
#   --yes              do not ask
#
set -euo pipefail

REPO_URL="https://raw.githubusercontent.com/verhoturkin/teacher-box"

dir=/opt/teacher-box
bin_dir=/usr/local/bin
ref=main
source_dir=""
domain=""
domain_set=false
timezone=""
port=""
calls=""
version=""
start=true
pull=true
assume_yes=false

say() { printf '%s\n' "$*"; }
step() { printf '\n==> %s\n' "$*"; }
fail() {
    printf 'Ошибка: %s\n' "$*" >&2
    exit 1
}

usage() {
    if [ -f "$0" ]; then
        sed -n '2,/^set -euo/p' "$0" | sed -e '/^set -euo/d' -e 's/^# \{0,1\}//'
    else
        say "Параметры: $REPO_URL/main/scripts/install.sh"
    fi
}

while [ $# -gt 0 ]; do
    case "$1" in
        --domain) domain="${2:-}"; domain_set=true; shift ;;
        --timezone) timezone="${2:-}"; shift ;;
        --port) port="${2:-}"; shift ;;
        --calls) calls=yes ;;
        --no-calls) calls=no ;;
        --version) version="${2:-}"; shift ;;
        --dir) dir="${2:-}"; shift ;;
        --bin) bin_dir="${2:-}"; shift ;;
        --ref) ref="${2:-}"; shift ;;
        --source) source_dir="${2:-}"; shift ;;
        --no-start) start=false ;;
        --no-pull) pull=false ;;
        --yes | -y) assume_yes=true ;;
        --help | -h) usage; exit 0 ;;
        *) fail "неизвестный параметр $1 (--help — список)" ;;
    esac
    shift
done

# Questions are read from the terminal, so that "curl ... | bash" can ask them too.
interactive=false
if [ "$assume_yes" = false ] && { : </dev/tty; } 2>/dev/null; then
    interactive=true
fi

# ask <question> <default>: prints the answer (the default on an empty line or without a terminal).
ask() {
    local answer=""
    if [ "$interactive" = true ]; then
        printf '%s' "$1" >/dev/tty
        [ -n "$2" ] && printf ' [%s]' "$2" >/dev/tty
        printf ': ' >/dev/tty
        IFS= read -r answer </dev/tty || true
    fi
    printf '%s' "${answer:-$2}"
}

# confirm <question> <y|n>: succeeds on "yes".
confirm() {
    local hint="Y/n" answer
    [ "$2" = n ] && hint="y/N"
    answer="$(ask "$1 ($hint)" "")"
    answer="${answer:-$2}"
    case "$answer" in
        [YyДд]*) return 0 ;;
        *) return 1 ;;
    esac
}

# random <length>: letters and digits from /dev/urandom.
random() {
    local out=""
    while [ "${#out}" -lt "$1" ]; do
        out="$out$(head -c 48 /dev/urandom | base64 | tr -d '+/=\n')"
    done
    printf '%s' "${out:0:$1}"
}

fetch() {
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO "$2" "$1"
    else
        fail "нужен curl или wget"
    fi
}

# get <path in the repository> <destination>
get() {
    if [ -n "$source_dir" ]; then
        cp "$source_dir/$1" "$2"
    else
        fetch "$REPO_URL/$ref/$1" "$2"
    fi
}

# set_env <file> <name> <value>: replaces the first "NAME=" or "# NAME=" line, or appends one.
set_env() {
    local file="$1" name="$2" value="$3" tmp
    tmp="$(mktemp)"
    awk -v name="$name" -v value="$value" '
        !done && $0 ~ "^#? *" name "=" { print name "=" value; done = 1; next }
        { print }
        END { if (!done) print name "=" value }
    ' "$file" >"$tmp"
    cat "$tmp" >"$file"
    rm -f "$tmp"
}

# get_env <file> <name>: the value of an uncommented "NAME=" line.
get_env() {
    awk -F= -v name="$2" '$1 == name { sub(/^[^=]*=/, ""); value = $0 } END { print value }' "$1"
}

# ---------------------------------------------------------------- checks
if [ "$start" = true ]; then
    [ "$(uname -s)" = Linux ] || fail "установщик работает на Linux; на других системах — README «Установка»"
    [ "$(id -u)" -eq 0 ] || fail "запустите от root: curl -fsSL $REPO_URL/main/scripts/install.sh | sudo bash"

    if ! command -v docker >/dev/null 2>&1; then
        step "Docker не найден"
        if [ "$assume_yes" = true ] || confirm "Установить Docker (скрипт get.docker.com)?" y; then
            fetch https://get.docker.com /tmp/get-docker.sh
            sh /tmp/get-docker.sh
            rm -f /tmp/get-docker.sh
        else
            fail "установите Docker: https://docs.docker.com/engine/install/"
        fi
    fi
    docker info >/dev/null 2>&1 || fail "Docker не запущен: systemctl start docker"
    compose_version="$(docker compose version --short 2>/dev/null || true)"
    [ -n "$compose_version" ] || fail "нужен Docker Compose v2 (пакет docker-compose-plugin)"
    compose_version="${compose_version#v}"
    major="${compose_version%%.*}"
    minor="${compose_version#*.}"
    minor="${minor%%.*}"
    if [ "$major" -lt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -lt 24 ]; }; then
        fail "Docker Compose $compose_version устарел, нужен 2.24 или новее"
    fi
fi

# ---------------------------------------------------------------- files
mkdir -p "$dir"
env_file="$dir/.env"
existing=false
[ -f "$env_file" ] && existing=true

step "Файлы портала в $dir"
get compose.yaml "$dir/compose.yaml.new"
mv "$dir/compose.yaml.new" "$dir/compose.yaml"

if [ "$existing" = true ]; then
    say "Настройки $env_file уже есть — оставляю их без изменений."
else
    say "Teacher Box: несколько вопросов (Enter — значение в скобках)."
    if [ "$domain_set" = false ]; then
        domain="$(ask "Домен портала для HTTPS, например school.example.com (пусто — без HTTPS, порт 8080)" "")"
    fi
    domain="${domain#http://}"
    domain="${domain#https://}"
    domain="${domain%%/*}"
    if [ -z "$timezone" ]; then
        timezone="$(ask "Часовой пояс" "Europe/Moscow")"
    fi
    if [ -z "$calls" ]; then
        if confirm "Включить звонки в портале (нужны открытые UDP-порты)?" y; then calls=yes; else calls=no; fi
    fi

    get .env.example "$env_file"
    chmod 600 "$env_file"
    set_env "$env_file" TEACHERBOX_TIMEZONE "$timezone"
    profiles=""
    if [ -n "$domain" ]; then
        set_env "$env_file" TEACHERBOX_DOMAIN "$domain"
        set_env "$env_file" TEACHERBOX_HTTP_PORT "127.0.0.1:${port:-8080}"
        profiles="https"
    elif [ -n "$port" ]; then
        set_env "$env_file" TEACHERBOX_HTTP_PORT "$port"
    fi
    if [ "$calls" = yes ]; then
        set_env "$env_file" TEACHERBOX_MEETINGS_LIVEKIT_API_KEY "teacherbox"
        set_env "$env_file" TEACHERBOX_MEETINGS_LIVEKIT_API_SECRET "$(random 48)"
        profiles="${profiles:+$profiles,}calls"
    fi
    [ -n "$profiles" ] && set_env "$env_file" COMPOSE_PROFILES "$profiles"
    [ -n "$version" ] && set_env "$env_file" TEACHERBOX_VERSION "$version"
    say "Настройки записаны в $env_file (пароль учителя создаст портал при первом запуске)."
fi

# The "teacherbox" command knows where the installation is and where updates come from.
mkdir -p "$bin_dir"
get scripts/teacherbox "$bin_dir/teacherbox.new"
sed -i.bak -e "s|^TEACHERBOX_DIR=.*|TEACHERBOX_DIR=\"\${TEACHERBOX_DIR:-$dir}\"|" \
    -e "s|^TEACHERBOX_REF=.*|TEACHERBOX_REF=\"\${TEACHERBOX_REF:-$ref}\"|" "$bin_dir/teacherbox.new"
rm -f "$bin_dir/teacherbox.new.bak"
chmod 755 "$bin_dir/teacherbox.new"
mv "$bin_dir/teacherbox.new" "$bin_dir/teacherbox"
say "Команда teacherbox: $bin_dir/teacherbox"

if [ "$start" = false ]; then
    step "Файлы готовы, портал не запускался (--no-start)"
    exit 0
fi

# ---------------------------------------------------------------- start
step "Скачиваю образы и запускаю портал"
cd "$dir"
[ "$pull" = false ] || docker compose pull --quiet
docker compose up -d --remove-orphans --wait --wait-timeout 300 ||
    fail "портал не запустился: teacherbox logs"

domain="$(get_env "$env_file" TEACHERBOX_DOMAIN)"
profiles="$(get_env "$env_file" COMPOSE_PROFILES)"
if [ -n "$domain" ]; then
    address="https://$domain"
else
    ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    http_port="$(get_env "$env_file" TEACHERBOX_HTTP_PORT)"
    address="http://${ip:-<адрес-сервера>}:${http_port:-8080}"
fi
login="$(get_env "$env_file" TEACHERBOX_IDENTITY_TEACHER_LOGIN)"
password="$(docker compose logs backend 2>/dev/null | sed -n 's/.*Teacher account created\. Login: [^ ]*  Password: \([^ ]*\).*/\1/p' | tail -1 || true)"

step "Teacher Box работает"
say "Адрес:  $address"
say "Логин:  ${login:-teacher}"
if [ -n "$password" ]; then
    say "Пароль: $password  (портал попросит сменить его после первого входа; сохраните его сейчас)"
elif [ "$existing" = true ]; then
    say "Пароль: прежний."
else
    say "Пароль: в журнале — teacherbox logs backend | grep \"Teacher account\""
fi
say ""
say "Откройте на сервере (и в файрволе облачного провайдера, если он есть) порты:"
if [ -n "$domain" ]; then
    say "  80/tcp и 443/tcp, 443/udp — HTTPS; домен $domain должен указывать на этот сервер."
else
    say "  ${http_port:-8080}/tcp — портал."
fi
case ",$profiles," in
    *,calls,*) say "  7881/tcp, 7882/udp, 3478/udp, 30000-30049/udp — звонки." ;;
esac
say ""
say "Обслуживание: teacherbox status | logs | update | backups | config | help"
