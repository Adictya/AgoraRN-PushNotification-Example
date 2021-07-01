import React, {Component} from 'react';
import {
  PermissionsAndroid,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Button,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-community/async-storage';
import messaging from '@react-native-firebase/messaging';
import database from '@react-native-firebase/database';
import RtcEngine from 'react-native-agora';
import RNCallKeep from 'react-native-callkeep';

export default class AgoraView extends Component {
  //INITIALIZATIONS

  constructor(props) {
    super(props);
    this.state = {
      localCode: '',
      remoteCode: '',
      calling: false,
      //Agora RTC state
      channel: 'callTest',
      openMicrophone: true,
      callActive: false,
    };
  }

  appId = '1e6816ded05149088f32daa1c0d19456';
  callUUID = '1234';

  init = async () => {
    this._engine = await RtcEngine.create(this.appId);
    await this._engine.enableAudio();

    this._engine.addListener('UserJoined', () => {
      if (this.state.calling) RNCallKeep.setCurrentCallActive(this.callUUID);
      console.log('User joined call');
    });

    this._engine.addListener('JoinChannelSuccess', (channel, uid, elapsed) => {
      // RNCallKeep.setCurrentCallActive(this.callUUID);
      console.log('JoinChannelSuccess', channel, uid, elapsed);

      this.setState({
        ...this.state,
        callActive: true,
      });
    });
  };

  // LIFECYCLE

  componentDidMount() {
    // Agora RTC Setup
    this.init();

    // CallKit Setup
    this.callUUID = this.state.channel;
    const options = {
      ios: {
        appName: 'My app name',
      },
      android: {
        alertTitle: 'Permissions required',
        alertDescription:
          'This application needs to access your phone accounts',
        cancelButton: 'Cancel',
        okButton: 'ok',
        imageName: 'phone_account_icon',
        foregroundService: {
          channelId: 'com.notfiCallKitRn',
          channelName: 'Foreground service for my app',
          notificationTitle: 'My app is running on background',
          notificationIcon: 'Path to the resource icon of the notification',
        },
        selfManaged: false,
      },
    };

    RNCallKeep.setup(options).then(accepted => {});

    this.rnCallKeepHandlers();

    // Push Notification Setup
    messaging().setBackgroundMessageHandler(this.notificationHandler);

    messaging().onMessage(this.notificationHandler);
  }

  // HANDLERS

  notificationHandler = async remoteMessage => {
    const {callerCode} = JSON.parse(remoteMessage.data.body) || '66666';
    console.log('I got a remote message : ' + JSON.stringify(callerCode));
    if (callerCode) {
      RNCallKeep.backToForeground();
      RNCallKeep.displayIncomingCall(this.callUUID, callerCode);
    }
  };

  rnCallKeepHandlers = () => {
    RNCallKeep.addEventListener('answerCall', async ({callUUID}) => {
      RNCallKeep.setCurrentCallActive(callUUID);
      console.log('id' + JSON.stringify(callUUID));
      this._engine.joinChannel(null, 'callTest', null, 0);
    });

    RNCallKeep.addEventListener(
      'didPerformSetMutedCallAction',
      ({muted, callUUID}) => {
        this._engine.joinChannel(null, 'callTest', null, 0);
      },
    );

    RNCallKeep.addEventListener('didReceiveStartCallAction', () => {
      this._engine.joinChannel(null, 'callTest', null, 0);
    });
    // RNCallKeep.addEventListener(
    //   'showIncomingCallUi',
    //   ({handle, callUUID, name}) => {
    //     RNCallKeep.backToForeground();
    //     this.setState({...this.state, calling: true});
    //     // RNCallKeep.answerIncomingCall(callUUID);
    //   },
    // );
  };

  remoteCodeHandler = value => {
    if (value.length <= 4) this.setState({...this.state, remoteCode: value});
  };

  codeHandler = async () => {
    let localCode = await AsyncStorage.getItem('localCode');
    if (localCode) this.setState({localCode: localCode});
    else {
      localCode = String(Math.floor(Math.random() * 10000));
      this.setState({localCode: localCode});
      AsyncStorage.setItem('localCode', localCode);
      const fcmToken = await messaging().getToken();
      console.log(fcmToken);
      if (fcmToken)
        database().ref(`FCMTokens/${this.state.localCode}`).set(fcmToken);
    }
    console.log('UserId: ' + localCode);
  };

  answerCallHandler = () => {
    this.setState({...this.state, calling: false});
    RNCallKeep.answerIncomingCall(this.callUUID);
  };

  callHandler = async () => {
    console.log('I am calling someone');
    // Testing route
    // 'http://localhost:5001/agoranotifrn/us-central1/sendHttpPushNotification',
    try {
      const code = await fetch(
        'https://us-central1-agoranotifrn.cloudfunctions.net/sendHttpPushNotification',
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            userId: this.state.remoteCode,
            data: JSON.stringify({callerCode: this.state.localCode}),
            title: 'From app',
            message: 'I am from your app',
          }),
        },
      );
      RNCallKeep.startCall(this.callUUID, this.state.remoteCode);
      this.setState({...this.state, calling: true});
    } catch (e) {
      console.log(e);
    }
  };

  _joinChannel = async () => {
    console.log('Joining Channel');
    this._engine.joinChannel(null, 'callTest', null, 0);
  };

  _leaveChannel = async () => {
    console.log('Leaving Channel');
    await this._engine?.leaveChannel();
    this.setState({peerIds: [], callActive: false});
  };

  _switchMicrophone = () => {
    const {openMicrophone} = this.state;
    this._engine
      ?.enableLocalAudio(!openMicrophone)
      .then(() => {
        this.setState({openMicrophone: !openMicrophone});
      })
      .catch(err => {
        console.warn('enableLocalAudio', err);
      });
  };

  // Switch the audio playback device.
  _switchSpeakerphone = () => {
    const {enableSpeakerphone} = this.state;
    this._engine
      ?.setEnableSpeakerphone(!enableSpeakerphone)
      .then(() => {
        this.setState({enableSpeakerphone: !enableSpeakerphone});
      })
      .catch(err => {
        console.warn('setEnableSpeakerphone', err);
      });
  };

  styles = StyleSheet.create({
    sectionContainer: {
      marginTop: 32,
      paddingHorizontal: 24,
    },
    sectionTitle: {
      marginTop: 16,
      marginLeft: 16,
      fontSize: 32,
      fontWeight: 'bold',
      color: this.props.isDarkMode ? '#099dfd' : 'black',
    },
    sectionDescription: {
      marginVertical: 8,
      marginLeft: 16,
      fontSize: 14,
      fontWeight: '400',
      color: this.props.isDarkMode ? 'white' : 'black',
    },
    codeDisplay: {
      textAlign: 'center',
      fontSize: 28,
      fontWeight: 'bold',
      color: this.props.isDarkMode ? 'white' : 'black',
    },
    card: {
      marginTop: 8,
      borderRadius: 3,
      backgroundColor: this.props.isDarkMode ? '#212121' : '#ddd',
      marginHorizontal: 16,
    },
    codeInputBox: {
      textAlign: 'center',
      fontSize: 28,
      fontWeight: 'bold',
      borderBottomColor: '#099dfd',
      borderBottomWidth: 1,
      marginHorizontal: 8,
      marginVertical: 8,
      color: this.props.isDarkMode ? 'white' : 'black',
    },
    callButton: {
      marginHorizontal: 8,
      marginVertical: 8,
      color: 'black',
    },
  });

  render() {
    return (
      <SafeAreaView>
        <Text style={this.styles.sectionTitle}>Welcome,</Text>
        <View style={this.styles.card}>
          <Text style={this.styles.sectionDescription}>Your code is:</Text>
          {this.state.localCode ? (
            <Text style={this.styles.codeDisplay}>{this.state.localCode}</Text>
          ) : (
            <Button onPress={this.codeHandler} title="Register" />
          )}
        </View>
        {this.state.localCode ? (
          <View>
            <View style={this.styles.card}>
              <Text style={this.styles.sectionDescription}>Dial a number:</Text>
              <TextInput
                style={this.styles.codeInputBox}
                keyboardType="number-pad"
                value={this.state.remoteCode}
                onChangeText={this.remoteCodeHandler}
              />
              <Button onPress={this.callHandler} title="Call" />
              <Text>or</Text>
              <Button onPress={this._joinChannel} title="Join Channel" />
            </View>
          </View>
        ) : null}
        {this.state.callActive ? (
          <View>
            <Text>Degug:{JSON.stringify(this.state)}</Text>
            <Button
              onPress={this._switchMicrophone}
              title={`Microphone ${this.state.openMicrophone ? 'on' : 'off'}`}
            />
            <Button
              onPress={this._switchSpeakerphone}
              title={
                this.state.enableSpeakerphone ? 'Speakerphone' : 'Earpiece'
              }
            />
            <Button
              onPress={this._leaveChannel}
              color="red"
              title="Leave Channel"
            />
          </View>
        ) : null}
      </SafeAreaView>
    );
  }
}

// onPress={() =>
//   RNCallKeep.displayIncomingCall(this.callUUID, '66666')
// }
//
//
// {this.state.calling ? (
//   <Button title="Answer Call" onPress={this.answerCallHandler} />
// ) : null}
// <Button
//   onPress={() => RNCallKeep.endCall(this.callUUID)}
//   color="red"
//   title="EndCall"
// />
