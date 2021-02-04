FROM node:15-buster-slim
COPY ./src /build/src
COPY ./package.* /build/
COPY ./ts* /build/
RUN cd /build && \
    npm install && \
    npm run build

FROM node:15-buster-slim
RUN mkdir -p /app
COPY --from=0 /build/dist /app/
COPY --from=0 /build/node_modules /app/node_modules
WORKDIR /app
CMD ["node", "app.js", "/config/config.json"]
