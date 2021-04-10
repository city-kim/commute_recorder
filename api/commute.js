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

const actions = (req, res) => {
  if (req.body.payload) {
    let reqBody = JSON.parse(req.body.payload)
    switch (reqBody.actions[0].action_id) {
      case 'go_to_work': {
        // 출근
        goToWork(reqBody.user.id, reqBody.actions[0].value, reqBody.message.ts);
        break;
      }
      case 'out_work': {
        // 퇴근
        outWork(reqBody.user.id, reqBody.actions[0].value, reqBody.message.ts);
        break;
      }
      case 'delete_work':
      case 'delete_out_work': {
        // 삭제
        deleteWork(reqBody.user.id, reqBody.actions[0].value, reqBody.message.ts, reqBody.actions[0].action_id);
        break;
      }
      case 'update_commute_time': {
        updateCommute(reqBody.user.id, reqBody.actions[0].selected_option.value, reqBody.message.ts, reqBody.actions[0].action_id)
        break;
      }
      default: {
        skpiWorkBtn(reqBody.user.id, reqBody.actions[0].value, reqBody.message.ts, reqBody.actions[0].action_id);
        break;
      }
    }
  }
  // res.send('TEST')
}

function goToWork (id, name, ts) {
  // 출근시키기
  let connection = mysql.createConnection(mysqlData);
  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, name, ts, '출근DB연결실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
      throw err;
    }
    // 이미 출근했는지
    connection.query(`select * from commute where slack_id = "${id}" and type = 'in'`, function (err, result) {
      if (err) {
        callError(id, name, ts, '출근정보검색실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
        connection.rollback();
      }
      let todayCheck = false;
      if (result && result.length > 0) {
        // 값이 있다면 오늘이랑 같은지 비교하기
        let today = moment().format('YYYY-MM-DD');
        let dbDay = moment(result[0].time).format('YYYY-MM-DD')
        if (moment(today).isSame(dbDay)) {
          // 오늘과 같은지 체크
          todayCheck = true;
        }
      }
      if (!todayCheck) {
        // 출근내역이 없다면 insert
        connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
          if (err) {
            callError(id, name, ts, '출근 앱 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
            connection.rollback();
          }
          if (res) {
            commute_slak.commute_work_done(id, name, ts, res[0].chat_channel)
              .then((res) => {
                // 출근 채팅방에 슬랙메시지 전송
                connection.query(`INSERT INTO commute VALUES("${id}", "${moment().format('YYYY-MM-DD HH:mm:ss')}", "${ts}", "${res.ts}", "in")`, function (err, result) {
                  if (err) {
                    callError(id, name, ts, 'DB에 출근정보 입력실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
                    connection.rollback();
                  }
                  connection.commit(function (err) {
                    if (err) {
                      callError(id, name, ts, '출근 트렌젝션 커밋실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
                      connection.rollback();
                    }
                  });
                });
              })
              .catch((err) => {
                callError(id, name, ts, '출근채팅입력실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
              })
          }
        });
      } else {
        // 이미 출근했다면 앱채팅 업데이트
        connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
          if (err) {
            callError(id, name, ts, '출근 앱 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
            connection.rollback();
          }
          if (res) {
            connection.rollback();
            commute_slak.commute_work_done(id, name, ts, res[0].chat_channel);
          }
        });
      }
    });
  });
}

function outWork (id, name, ts) {
  // 퇴근시키기
  let connection = mysql.createConnection(mysqlData);
  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, name, ts, '퇴근DB연결실패', moment().format('YYYY-MM-DD HH:mm:ss'), err)
      throw err;
    }
    // 이미 퇴근했는지
    connection.query(`select * from commute where slack_id = "${id}" and type = "out"`, function (err, result) {
      if (err) {
        callError(id, name, ts, '퇴근정보검색실패', moment().format('YYYY-MM-DD HH:mm:ss'), err)
        connection.rollback();
      }
      let todayCheck = false;
      if (result && result.length > 0) {
        // 값이 있다면 오늘이랑 같은지 비교하기
        let today = moment().format('YYYY-MM-DD');
        let dbDay = moment(result[0].time).format('YYYY-MM-DD')
        if (moment(today).isSame(dbDay)) {
          // 오늘과 같은지 체크
          todayCheck = true;
        }
      }
      if (!todayCheck) {
        // 퇴근내역이 없다면 insert
        connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
          if (err) {
            callError(id, name, ts, '퇴근 앱 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
            connection.rollback();
          }
          if (res) {
            commute_slak.commute_out_done(id, name, ts, res[0].chat_channel)
              .then((res) => {
                // 출근 채팅방에 슬랙메시지 전송
                connection.query(`INSERT INTO commute VALUES("${id}", "${moment().format('YYYY-MM-DD HH:mm:ss')}", "${ts}", "${res.ts}", "out")`, function (err, result) {
                  if (err) {
                    callError(id, name, ts, 'DB에 출근정보 입력실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
                    connection.rollback();
                  }
                  connection.commit(function (err) {
                    if (err) {
                      callError(id, name, ts, '출근 트렌젝션 커밋실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
                      connection.rollback();
                    }
                  });
                });
              })
              .catch((err) => {
                callError(id, name, ts, '퇴근채팅입력실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
              })
          }
        });
      } else {
        // 이미 퇴근했다면 완료로찍기
        connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
          if (err) {
            callError(id, name, ts, '퇴근 앱 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
            connection.rollback();
          }
          if (res) {
            connection.rollback();
            commute_slak.commute_out_done(id, name, ts, res[0].chat_channel);
          }
        });
      }
    });
  });
}

function deleteWork (id, name, ts, type) {
  // 기록삭제하기
  let del_type = type === 'delete_work' ? 'in' : 'out';
  let connection = mysql.createConnection(mysqlData);
  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, name, ts, `${type}: DB연결실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
      throw err;
    }
    // 기록찾기
    connection.query(`SELECT * FROM commute c
                      LEFT JOIN slack_id s
                      ON s.slack_id = c.slack_id
                      WHERE c.ts = "${ts}"
                      AND c.type = "${del_type}"`, function (err, result) {
      if (err) {
        callError(id, name, ts, `${type}: 정보검색실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
        connection.rollback();
      }
      if (result && result.length > 0) {
        // 내역이 있다면 삭제
        const channel_ts = result[0].channel_ts; // 채팅방에 입력된 ts
        const chat_channel = result[0].chat_channel; // 앱과 채팅중인 채널명
        connection.query(`delete from commute where ts = "${ts}" and type = "${del_type}"`, function (err, result) {
          if (err) {
            callError(id, name, ts, `${type}: DB에 정보 삭제실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err, chat_channel)
            connection.rollback();
          }
          connection.commit(function (err) {
            if (err) {
              callError(id, name, ts, `${type}: 트렌젝션 커밋실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err, chat_channel)
              connection.rollback();
            } else {
              // 성공
              commute_slak.commute_delete_done(name, ts, type, channel_ts, chat_channel);
            }
          });
        });
      } else {
        // 내역이 없다면 그냥 돌려놓기
        connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
          if (err) {
            callError(id, name, ts, '퇴근 앱 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err, res[0].chat_channel);
            connection.rollback();
          }
          if (res) {
            connection.rollback();
            commute_slak.commute_delete_done(name, ts, type, res[0].chat_channel);
          }
        });
      }
    });
  });
}

function updateCommute (id, time, ts, type) {
  // 출근시간알림 업데이트
  let connection = mysql.createConnection(mysqlData);
  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, time, ts, '업데이트 DB연결 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err)
      throw err;
    }
    connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, res) {
      if (err) {
        callError(id, time, ts, '업데이트 채팅방 정보읽기 실패', moment().format('YYYY-MM-DD HH:mm:ss'), err);
        connection.rollback();
      }
      if (res) {
        connection.query(`UPDATE slack_id
                      SET time = "${time}:00"
                      WHERE slack_id = "${id}"`, function (err, result) {
          if (err) {
            callError(id, time, ts, `${type}: 출근시간 업데이트 실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
            connection.rollback();
          }
          connection.commit(function (err) {
            if (err) {
              callError(id, time, ts, `${type}: 트렌젝션 커밋실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err, chat_channel)
              connection.rollback();
            } else {
              // 성공
              commute_slak.commute_update_done(time, ts, res[0].chat_channel);
            }
          });
        });
      }
    });
  });

  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, time, ts, `${type}: DB연결실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
      throw err;
    }
  });
}

function callError (id, name, ts, type, err) {
  commute_slak.commute_fail(id, name, ts, type, moment().format('YYYY-MM-DD HH:mm:ss'), err);
}

function skpiWorkBtn (id, name, ts, type) {
  // 스킵할경우 메시지만 업데이트
  let connection = mysql.createConnection(mysqlData);
  connection.beginTransaction(function (err) {
    if (err) {
      callError(id, name, ts, `${type}: DB연결실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
      throw err;
    }
    // 기록찾기
    connection.query(`select chat_channel from slack_id where slack_id = "${id}"`, function (err, result) {
      if (err) {
        callError(id, name, ts, `${type}: 정보검색실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
        connection.rollback();
      }
      if (result && result.length > 0) {
        connection.commit(function (err) {
          if (err) {
            callError(id, name, ts, `${type}: 트렌젝션 커밋실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err, result[0].chat_channel)
            connection.rollback();
          } else {
            // 성공
            commute_slak.commute_skip(name, ts, type, result[0].chat_channel);
          }
        });
      }
    });
  });
}

module.exports = {
  actions
}