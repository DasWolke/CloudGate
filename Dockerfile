FROM node:lts
RUN useradd app
WORKDIR /home/app
ADD . /home/app
RUN npm install && cp -R node_modules/Cloudstorm node_modules/cloudstorm
CMD ["node", "."]