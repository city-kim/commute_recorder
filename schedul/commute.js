require('dotenv').config();
const moment = require('moment-timezone');
const mysql = require('mysql');
const mysqlData = {
  port: process.env.DB_PORT,
  host: process.env.DH_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_SECRET,
  database: process.env.DB_DATABASE
}

const commute_slak = require('../util/slack.js')

const loadCalandar = () => {
  // 달력 로드하기
  const calendar = require('../util/google_calendar.js');
  calendar.googleCalendarLoad();
}

const dailyCall = (holiday, events) => {
  // 매일 노티보내기
  let today = moment();
  // console.log(events)
  console.log('알림시작')
  if (!holiday) {
    // 넘어온 휴일이 없다면 동작
    if (today.day() != 7 && today.day() != 0) {
      // 토요일7 일요일0 제외하고 보내기
      let connection = mysql.createConnection(mysqlData);
      // 알림데이터 가져오기
      let noewTimer = `${moment().format('HH:mm')}:00` // 현재시간 데이터 변수로 참조
      connection.query(`SELECT * FROM slack_id where time = "${noewTimer}"`, function (error, results, fields) {
        // DB에 슬랙데이터 있는지 확인
        if (error) {
          console.log(`알림대상 조회실패 ${moment().format('YYYY-MM-DD (dddd) HH:mm')}`)
          console.log(error)
          connection.end();
        }
        if (results && results.length > 0) {
          // 슬랙아이디 검색됨
          let todayList = [] // 오늘 휴일자
          console.log(`휴일자 ${todayList}`)
          if (events) {
            // 이벤트가 있다면 누구인지 찾아오기
            todayList = events.reduce((acc, cur) => {
              const startDate = cur.start.dateTime || cur.start.date;
              if (today.format('YYYY-MM-DD') === moment(startDate).format('YYYY-MM-DD')) {
                // 오늘과 날짜가 일치한다면 필터대상
                if (cur.start.dateTime) {
                  // 시작시간이 있는데
                  if (moment(cur.start.dateTime).format('HH') < 10) {
                    // 시작시간이 10시보다 작다면 제외대상
                    acc.push(cur.summary.replace(/ /g, ''))
                  }
                } else {
                  // 일자만 있다면 연차이므로 제외대상
                  acc.push(cur.summary.replace(/ /g, ''))
                }
              }
              return acc
            }, [])
          }
          let sendList = [];
          for (const i in results) {
            let isVacation = false;
            for (const idx in todayList) {
              // 가져온 slack_id 리스트에서 휴일자 찾기
              if (todayList[idx].indexOf(results[i].name) > -1) {
                // 있다면 전송대상에서 제외
                isVacation = true;
                break;
              }
            }
            if (!isVacation) {
              // for문 종료 후 휴가가 아니라면 전송대상에 추가
              let obj = {
                slack_id: results[i].slack_id,
                name: results[i].name,
                chat_channel: results[i].chat_channel,
                time: results[i].time,
              }
              sendList.push(obj)
            }
          }
          // 슬랙메시지 보내기!
          console.log(`전송대상 ${JSON.stringify(sendList)}`)
          connection.end();
          console.log(`${moment().format('YYYY-MM-DD HH:mm')} 알림전송 대상의 출근시간: ${noewTimer}`);
          for (let i in sendList) {
            commute_slak.commute_send(sendList[i].slack_id, sendList[i].name, sendList[i].chat_channel);
          }
        } else {
          console.log(`${moment().format('YYYY-MM-DD (dddd) HH:mm')} 전송대상을 찾지못함`)
          connection.end();
        }
      })
    } else {
      console.log(`휴일 ${moment().format('YYYY-MM-DD (dddd) HH:mm')}`);
    }
  } else {
    console.log(`공휴일 ${moment().format('YYYY-MM-DD (dddd) HH:mm')}`);
  }
}

module.exports = {
  dailyCall,
  loadCalandar
}