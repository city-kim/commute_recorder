const axios = require('axios');
const moment = require('moment-timezone');
require('dotenv').config();
const mysql = require('mysql');
const mysqlData = {
  port: process.env.DB_PORT,
  host: process.env.DH_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_SECRET,
  database: process.env.DB_DATABASE
}

const commute_send = (id, name, channel) => {
  // 출근메시지 보내기
  if (channel) {
    deleteBotMessage(id, channel, name)
  } else {
    sendSlackBotMessage(id, {
      "channel": id,
      "text": "출근기록알림",
      "blocks": [
        {
          "type": "section",
          "text": { "type": "mrkdwn", "text": "출근하기" }
        },
        {
          "type": "actions",
          "elements": [
            {
              "type": "button",
              "text": { "type": "plain_text", "text": "출근", "emoji": true },
              "value": name,
              "action_id": "go_to_work"
            },
            {
              "type": "button",
              "text": { "type": "plain_text", "text": "수동입력함", "emoji": true },
              "value": name,
              "action_id": "skip_work"
            }
          ]
        }
      ]
    })
  }
}

const commute_work_done = (id, name, ts, channel) => {
  // 출근 완료동작
  return new Promise((resolve, reject) => {
    let nowTime = moment(); // 현재시간
    let dayArray = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    let timeText = `${moment().format('YYYY-MM-DD')}_${dayArray[nowTime.day()]}` // 오늘날짜 기록
    if (nowTime.format('mm') > 30) {
      // 30분 초과했을때 현재시간에 1시간을 더해줌
      nowTime.add(1, 'hours');
      nowTime.set('minute', 00);
      timeText = timeText += ` ${nowTime.format('HH:mm')} 출근`;
    } else {
      // 30분 이하일경우 더하지않음
      nowTime.set('minute', 30);
      timeText = timeText += ` ${nowTime.format('HH:mm')} 출근`;
    }
    sendCommuteMessage(`${name} ${timeText}`)
      .then((res) => {
        if (!res.error) {
          // 에러가 없다면 정상
          updateSlackMessage({
            "channel": channel,
            "ts": ts,
            "text": "출근완료",
            "blocks": [
              {
                "type": "section",
                "text": { "type": "mrkdwn", "text": `출근기록 삭제 및 퇴근하기 (퇴근예정시간 : ${nowTime.add(9, 'hours').format('HH:mm')})` }
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "button",
                    "text": { "type": "plain_text", "text": "출근기록삭제", "emoji": true },
                    "value": name,
                    "action_id": "delete_work"
                  },
                  {
                    "type": "button",
                    "text": { "type": "plain_text", "text": "퇴근", "emoji": true },
                    "value": name,
                    "action_id": "out_work"
                  }
                ]
              }
            ]
          })
          return resolve(res)
        } else {
          // 에러가있음
          return reject(res.error)
        }
      })
  })
}
const commute_out_done = (id, name, ts, channel) => {
  // 퇴근 완료동작
  return new Promise((resolve, reject) => {
    let nowTime = moment(); // 현재시간
    let dayArray = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    let timeText = `${moment().format('YYYY-MM-DD')}_${dayArray[nowTime.day()]} ${nowTime.format('HH:mm')}퇴근` // 오늘날짜 기록
    // if (nowTime.format('mm') > 30) {
    //   // 30분 초과했을때 현재시간에 1시간을 더해줌
    //   nowTime.add(1, 'hours');
    //   timeText = timeText += ` ${nowTime.format('HH')}:00 퇴근`;
    // } else {
    //   // 30분 이하일경우 더하지않음
    //   timeText = timeText += ` ${nowTime.format('HH')}:30 퇴근`;
    // }
    sendCommuteMessage(`${name} ${timeText}`)
      .then((res) => {
        if (!res.error) {
          // 에러가 없다면 정상
          updateSlackMessage({
            "channel": channel,
            "ts": ts,
            "text": "퇴근완료",
            "blocks": [
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "퇴근이 완료되었습니다"
                }
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "퇴근기록삭제",
                      "emoji": true
                    },
                    "value": name,
                    "action_id": "delete_out_work"
                  }
                ]
              },
              {
                "type": "divider"
              },
              {
                "type": "section",
                "text": {
                  "type": "mrkdwn",
                  "text": "출근시간알림을 재설정하려면 아래 시간을 선택하세요\n선택한 시간에 알림이갑니다"
                }
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "static_select",
                    "placeholder": {
                      "type": "plain_text",
                      "text": "시간을 선택하세요",
                      "emoji": true
                    },
                    "options": [
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "06:10"
                        },
                        "value": "06:10"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "06:20"
                        },
                        "value": "06:20"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "06:40"
                        },
                        "value": "06:40"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "06:50"
                        },
                        "value": "06:50"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "07:10"
                        },
                        "value": "07:10"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "07:20"
                        },
                        "value": "07:20"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "07:40"
                        },
                        "value": "07:40"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "07:50"
                        },
                        "value": "07:50"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "08:10"
                        },
                        "value": "08:10"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "08:20"
                        },
                        "value": "08:20"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "08:40"
                        },
                        "value": "08:40"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "08:50"
                        },
                        "value": "08:50"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "09:10"
                        },
                        "value": "09:10"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "09:20"
                        },
                        "value": "09:20"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "09:40"
                        },
                        "value": "09:40"
                      },
                      {
                        "text": {
                          "type": "plain_text",
                          "text": "09:50"
                        },
                        "value": "09:50"
                      }
                    ],
                    "action_id": "update_commute_time"
                  }
                ]
              }
            ]
          })
          return resolve(res)
        } else {
          // 에러가있음
          return reject(res.error)
        }
      })
  })
}

const commute_delete_done = (name, ts, type, channel_ts, channel) => {
  // 삭제 완료
  let blocks = []
  if (type == 'delete_work') {
    // 출근삭제
    blocks = [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": "출근하기" }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "출근", "emoji": true },
            "value": name,
            "action_id": "go_to_work"
          },
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "수동입력함", "emoji": true },
            "value": name,
            "action_id": "skip_work"
          }
        ]
      }
    ]
  } else {
    // 퇴근삭제
    blocks = [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": "퇴근하기" }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "퇴근", "emoji": true },
            "value": name,
            "action_id": "out_work"
          },
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "수동입력함", "emoji": true },
            "value": name,
            "action_id": "skip_out"
          }
        ]
      }
    ]
  }
  deleteCommuteMessage(channel_ts) // 채팅방에서 삭제하기
  updateSlackMessage({
    "channel": channel,
    "ts": ts,
    "text": "삭제되었습니다",
    "blocks": blocks
  })
}

const commute_update_done = (time, ts, channel) => {
  // 퇴근 후 출근시간 알림 업데이트 성공
  updateSlackMessage({
    "channel": channel,
    "ts": ts,
    "text": "출근시간 알림 업데이트 성공",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": `출근시간 알림이 업데이트되었습니다 ${time}`
        }
      },
      {
        "type": "divider"
      },
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "출근시간알림을 재설정하려면 아래 시간을 선택하세요\n선택한 시간에 알림이갑니다"
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "static_select",
            "placeholder": {
              "type": "plain_text",
              "text": "시간을 선택하세요",
              "emoji": true
            },
            "options": [
              {
                "text": {
                  "type": "plain_text",
                  "text": "06:10"
                },
                "value": "06:10"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "06:20"
                },
                "value": "06:20"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "06:40"
                },
                "value": "06:40"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "06:50"
                },
                "value": "06:50"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "07:10"
                },
                "value": "07:10"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "07:20"
                },
                "value": "07:20"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "07:40"
                },
                "value": "07:40"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "07:50"
                },
                "value": "07:50"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "08:10"
                },
                "value": "08:10"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "08:20"
                },
                "value": "08:20"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "08:40"
                },
                "value": "08:40"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "08:50"
                },
                "value": "08:50"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "09:10"
                },
                "value": "09:10"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "09:20"
                },
                "value": "09:20"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "09:40"
                },
                "value": "09:40"
              },
              {
                "text": {
                  "type": "plain_text",
                  "text": "09:50"
                },
                "value": "09:50"
              }
            ],
            "action_id": "update_commute_time"
          }
        ]
      }
    ]
  })
}

const commute_fail = (id, name, ts, type, time, error, channel) => {
  // 실패 하였을경우
  sendSlackBotMessage(null, {
    "channel": "channel",
    "text": "에러알림",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "에러보고"
        }
      },
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": `슬랙아이디: ${id}\n대상: ${name}\nts: ${ts}\n액션타입: ${type}\n발생시간: ${time}`
        }
      },
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": `${error}`
        }
      }
    ]
  })
  if (channel) {
    updateSlackMessage({
      "channel": channel,
      "ts": ts,
      "text": "에러가 발생했습니다.",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "에러가 발생했습니다."
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": "발생된 에러는 보고되었으나, 일시적으로 출퇴근을 작성할 수 없습니다.\n수동으로 작성해주세요",
            "emoji": true
          }
        }
      ]
    })
  }
}

const commute_skip = (name, ts, type, channel) => {
  // 입력 스킵하기
  let blocks = []
  if (type == 'skip_work') {
    // 출근스킵
    blocks = [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": "출근이 완료되었습니다.(수동입력)" }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": { "type": "plain_text", "text": "퇴근", "emoji": true },
            "value": name,
            "action_id": "out_work"
          }
        ]
      }
    ]
  } else {
    // 퇴근스킵
    blocks = [
      {
        "type": "section",
        "text": { "type": "mrkdwn", "text": "퇴근이 완료되었습니다.(수동입력)" }
      }
    ]
  }
  updateSlackMessage({
    "channel": channel,
    "ts": ts,
    "text": "수동입력처리되었습니다.",
    "blocks": blocks
  })
}

const sendCommuteMessage = (text) => {
  // 출퇴근기록하기
  return new Promise((resolve, reject) => {
    axios({
      method: 'post',
      url: 'https://slack.com/api/chat.postMessage',
      headers: { Authorization: `Authorization` },
      data: {
        "channel": "botchannel",
        "text": text,
      }
    })
      .then((res) => {
        if (res.data.ts) {
          // 성공
          return resolve(res.data)
        } else {
          return reject(new Error(res.data))
        }
      })
      .catch((err) => {
        // 에러
        console.log(err)
        return reject(new Error(err))
      })
  })
}

function sendSlackBotMessage (id, text) {
  // 봇으로 슬랙메시지 보내기
  axios({
    method: 'post',
    url: 'https://slack.com/api/chat.postMessage',
    headers: { Authorization: `Authorization` },
    data: text
  })
    .then((res) => {
      if (!res.data.ts) {
        // 실패
        slackErrorCatch(res.data, text);
      } else {
        if (id) {
          // 출근알림일경우
          updateChannel(res.data.channel, id);
        }
      }
    })
    .catch((err) => {
      console.log(err)
      slackErrorCatch(err, text);
    })
}

function updateSlackMessage (text) {
  // 봇메시지 업데이트하기
  axios({
    method: 'post',
    url: 'https://slack.com/api/chat.update',
    headers: { Authorization: `Authorization` }, // 슬랙봇 인증
    data: text
  })
    .then((res) => {
      if (!res.data.ts) {
        // 실패
        slackErrorCatch(res.data, text);
      }
    })
    .catch((err) => {
      slackErrorCatch(err, text);
    })
}

function deleteCommuteMessage (ts, channel) {
  // 기록삭제하기
  axios({
    method: 'post',
    url: 'https://slack.com/api/chat.delete',
    headers: { Authorization: `Authorization` }, // 슬랙봇 인증
    data: {
      "channel": channel ? channel : "botchannel", // 여기에 출퇴근채널을 적는다
      "ts": ts
    }
  })
    .then((res) => {
      if (!res.data.ts) {
        // 실패
        slackErrorCatch(res.data, ts);
      }
    })
    .catch((err) => {
      slackErrorCatch(err, ts);
    })
}

function deleteBotMessage (id, channel, name) {
  // 이전에 보낸 기록 모두삭제하기
  axios({
    method: 'get',
    url: `https://slack.com/api/conversations.history?channel=${channel}`,
    headers: { Authorization: `Authorization` }, // 슬랙봇 인증
    data: {
      "channel": id
    }
  })
    .then((res) => {
      if (res.data.ok) {
        if (res.data.messages.length > 0) {
          for (let i in res.data.messages) {
            if (res.data.messages[i].bot_profile) {
              deleteCommuteMessage(res.data.messages[i].ts, channel)
            }
          }
        }
        // 모든 삭제가 종료되면 발송
        sendSlackBotMessage(id, {
          "channel": id,
          "text": "출근기록알림",
          "blocks": [
            {
              "type": "section",
              "text": { "type": "mrkdwn", "text": "출근하기" }
            },
            {
              "type": "actions",
              "elements": [
                {
                  "type": "button",
                  "text": { "type": "plain_text", "text": "출근", "emoji": true },
                  "value": name,
                  "action_id": "go_to_work"
                },
                {
                  "type": "button",
                  "text": { "type": "plain_text", "text": "수동입력함", "emoji": true },
                  "value": name,
                  "action_id": "skip_work"
                }
              ]
            }
          ]
        })
      }
    })
    .catch((err) => {
      slackErrorCatch(err, { 'ID': id, 'CHANNEL': channel });
    })
}

function slackErrorCatch (err, text) {
  // 슬랙에러난경우 메시지날림
  axios({
    method: 'post',
    url: 'https://slack.com/api/chat.postMessage',
    headers: { Authorization: `Authorization` }, // 슬랙봇 인증
    data: {
      "channel": "channel",
      "text": "슬랙에러",
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": "에러보고"
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": text,
            "emoji": true
          }
        },
        {
          "type": "section",
          "text": {
            "type": "plain_text",
            "text": err,
            "emoji": true
          }
        }
      ]
    }
  })
  .then((response) => {
    // console.log(response.data)
  });
}

function updateChannel (channel, id) {
  // 슬랙 메시지 발송시 채널업데이트
  let connection = mysql.createConnection(mysqlData);
  connection.query(`update slack_id set chat_channel = "${channel}" where slack_id = "${id}"`, function (err, result) {
    if (err) {
      commute_fail(id, '', '', `DB에 봇채널 업데이트 실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
      connection.rollback();
    }
    connection.commit(function (err) {
      if (err) {
        commute_fail(id, '', '', `트렌젝션 커밋실패`, moment().format('YYYY-MM-DD HH:mm:ss'), err)
        connection.rollback();
      } else {
        // 성공
      }
    });
  });
}

module.exports = {
  commute_send,
  commute_work_done,
  commute_out_done,
  commute_update_done,
  commute_delete_done,
  commute_fail,
  commute_skip
}