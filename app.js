const express = require('express');
const app = express();
var cors = require('cors');
const apiController = require('./api/controller.js');
const schedule = require('node-schedule'); //모듈 
const bodyParser = require('body-parser');
const commute = require('./schedul/commute.js');
const moment = require('moment-timezone');

const rawBodyBuffer = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.use(bodyParser.urlencoded({ verify: rawBodyBuffer, extended: true }));
app.use(bodyParser.json({ verify: rawBodyBuffer }));

// app.use(express.json());
app.use('/api', cors(), apiController);

app.listen(3000, function () {
  console.log(`${moment().format('YYYY-MM-DD (dddd) HH:mm:ss')} 서버재시작`);
});

var callGoToWork = schedule.scheduleJob('0 0,10,20,30,40,50 6-9 * * 1-5', function () {
  // 매일 아침 6시부터 10시까지 0분 ~ 50분 출근알림 보내기
  commute.loadCalandar();
  console.log(`${moment().format('YYYY-MM-DD (dddd) HH:mm:ss')} 슬랙알림 스케줄러 시작`);
});