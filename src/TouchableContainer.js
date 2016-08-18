import React, { PureComponent } from 'react';

export default class TouchableContainer extends PureComponent {
  targetRotationX = 0;
  targetRotationY = 0;

  componentDidMount() {
    document.addEventListener('touchmove', this.handleTouchMove);
  }

  componentWillUnmount() {
    document.removeEventListener('touchmove', this.handleTouchMove);
  }

  componentWillReceiveProps(nextProps) {
    this.targetRotationX = nextProps.targetRotationX;
    this.targetRotationY = nextProps.targetRotationY;
  }

  render() {
    const { children, width, height } = this.props;

    return (
      <div
        onMouseDown={this.handleMouseDown}
        onTouchStart={this.handleTouchStart}
        style={{ width, height }}
      >
        {children}
      </div>
    );
  }

  handleTouchStart = event => {
    if (event.touches.length === 1) {
      event.preventDefault();

      const { width, height } = this.props;

      const windowHalfX = width / 2;
      const windowHalfY = height / 2;

      this.mouseXOnMouseDown = event.touches[0].pageX - windowHalfX;
      this.mouseYOnMouseDown = event.touches[0].pageY - windowHalfY;
      this.targetRotationOnMouseDownX = this.targetRotationX;
      this.targetRotationOnMouseDownY = this.targetRotationY;
    }
  };

  handleTouchMove = event => {
    if (event.touches.length === 1) {
      event.preventDefault();

      const { width, height } = this.props;

      const windowHalfX = width / 2;
      const windowHalfY = height / 2;

      this.mouseX = event.touches[0].pageX - windowHalfX;
      this.mouseY = event.touches[0].pageY - windowHalfY;

      this.targetRotationX = this.targetRotationOnMouseDownX +
        (this.mouseX - this.mouseXOnMouseDown) * 0.05;
      this.targetRotationY = this.targetRotationOnMouseDownY +
        (this.mouseY - this.mouseYOnMouseDown) * 0.05;

      this.props.onUpdateRotation({
        targetRotationX: this.targetRotationX,
        targetRotationY: this.targetRotationY
      })
    }
  };

  handleMouseDown = event => {
    event.preventDefault();

    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    document.addEventListener('mouseout', this.handleMouseOut);

    const { width, height } = this.props;

    const windowHalfX = width / 2;
    const windowHalfY = height / 2;

    this.mouseXOnMouseDown = event.clientX - windowHalfX;
    this.mouseYOnMouseDown = event.clientY - windowHalfY;

    this.targetRotationOnMouseDownX = this.targetRotationX;
    this.targetRotationOnMouseDownY = this.targetRotationY;
  };

  handleMouseMove = (event) => {
    const { width, height } = this.props;

    const windowHalfX = width / 2;
    const windowHalfY = height / 2;

    this.mouseX = event.clientX - windowHalfX;
    this.mouseY = event.clientY - windowHalfY;
    this.targetRotationX = this.targetRotationOnMouseDownX +
      (this.mouseX - this.mouseXOnMouseDown) * 0.02;
    this.targetRotationY = this.targetRotationOnMouseDownY +
      (this.mouseY - this.mouseYOnMouseDown) * 0.02;

    this.props.onUpdateRotation({
      targetRotationX: this.targetRotationX,
      targetRotationY: this.targetRotationY
    })
  };

  handleMouseUp = () => {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mouseout', this.handleMouseOut);
  };

  handleMouseOut = () => {
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('mouseout', this.handleMouseOut);
  };
}
