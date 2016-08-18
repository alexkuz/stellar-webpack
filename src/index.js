import React from 'react';
import ReactDOM from 'react-dom';
import WebpackGraph from './WebpackGraph';
import './index.css';

import 'basscss/css/basscss.css';
import 'basscss-colors/css/colors.css';
import 'basscss-background-colors/css/background-colors.css';

ReactDOM.render(
  <WebpackGraph />,
  document.getElementById('root')
);
