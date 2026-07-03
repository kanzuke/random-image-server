FROM node:20-alpine

# sharp nécessite quelques libs système sur alpine
RUN apk add --no-cache vips-dev

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY server.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -q --spider http://localhost:3000/health || exit 1

CMD ["node", "server.js"]
