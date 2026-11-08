#!/bin/sh
# If started as root (the default), make /data writable for the app user, then drop privileges.
# If started as a non-root user (compose "user:"), just run.
set -e
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /data 2>/dev/null || true
  exec su-exec node "$@"
fi
exec "$@"
