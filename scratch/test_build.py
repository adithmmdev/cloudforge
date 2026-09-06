import docker
client = docker.from_env()
with open('/app/uploads/mern-e-commerce-fullstack-template/Dockerfile', 'w') as f:
    f.write('''FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "src/dist/server.js"]
''')
print('Building...')
img, logs = client.images.build(path='/app/uploads/mern-e-commerce-fullstack-template/', rm=True)
print('Running...')
container = client.containers.run(img.id, detach=True)
container.wait()
print(container.logs().decode('utf-8'))
