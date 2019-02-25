FROM node:lts
RUN useradd app
WORKDIR /home/app
ADD . /home/app
RUN npm install && npm install daswolke/cloudstorm
CMD ["node", "."]