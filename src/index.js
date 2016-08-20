import 'babel-preset-es2017/polyfill';

import React from 'react';
import ReactDOM from 'react-dom';
import WebpackGraph from './WebpackGraph';
import './index.css';

import 'basscss/css/basscss.css';
import 'basscss-colors/css/colors.css';
import 'basscss-background-colors/css/background-colors.css';
import 'basscss-border-colors/css/border-colors.css';
import 'basscss-btn/css/btn.css';

ReactDOM.render(
  <WebpackGraph />,
  document.getElementById('root')
);
