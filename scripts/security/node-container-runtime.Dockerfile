# Runtime-only overlay. Keep the exact application image, code, entrypoint,
# dependencies, data mounts and declared user; never mutate a running container.
# Callers must pin both sources to verified sha256 image digests.
ARG NODE_SOURCE
ARG APP_SOURCE
FROM ${NODE_SOURCE} AS security_node
FROM ${APP_SOURCE}
ARG NODE_TARGET_PATH=/usr/local/bin/node
ARG NODE_VERSION=22.23.4
ARG APP_USER=node
ARG SECURITY_SOURCE_SHA
USER root
COPY --from=security_node /usr/local/bin/node ${NODE_TARGET_PATH}
RUN test "$("$NODE_TARGET_PATH" --version)" = "v$NODE_VERSION"
LABEL org.clevio.node-security.version="${NODE_VERSION}" \
      org.clevio.node-security.source-revision="${SECURITY_SOURCE_SHA}"
USER ${APP_USER}
