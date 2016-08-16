import React, { PureComponent } from 'react';
import { Graph, Layout } from './springy3d';
import React3 from 'react-three-renderer';
import THREE from 'three';

const leaves = [1, 2, 3];

const buildNodes = (parent, limit, level=0) => leaves.reduce(
  (arr, l) => level < limit ?
    [...arr, `${parent}-${l}`, ...buildNodes(`${parent}-${l}`, limit, level + 1)] :
    [...arr, `${parent}-${l}`],
  []
);

const buildEdges = (parent, limit, level=0) => leaves.reduce(
  (arr, l) => level < limit ?
    [...arr, [parent, `${parent}-${l}`], ...buildEdges(`${parent}-${l}`, limit, level + 1)] :
    [...arr, [parent, `${parent}-${l}`]],
  []
);

const buildGraphJSON = limit => ({
  nodes: ['node', ...buildNodes('node', limit)],
  edges: buildEdges('node', limit)
})

const getVertices = (edges, factor=5) => {
  const len = edges.length;
  const points = new Array(len * 2);

  for (var i = 0; i < len; i++) {
    const { p1, p2 } = edges[i];
    points[2*i] = new THREE.Vector3(p1.x * factor, p1.y * factor, p1.z * factor);
    points[2*i + 1] = new THREE.Vector3(p2.x * factor, p2.y * factor, p2.z * factor);
  }
  
  return points;
}

class WebpackGraphTree extends PureComponent {
  cameraPosition = new THREE.Vector3(0, 0, 1000);

  static defaultProps = {
    width: 800,
    height: 800
  }

  render() {
    const { width, height, edges, rotation, className, onAnimate } = this.props;

    return (
      <React3
        className={className}
        mainCamera="camera" // this points to the perspectiveCamera which has the name set to "camera" below
        width={width}
        height={height}
        onAnimate={onAnimate}
      >
        <scene>
          <perspectiveCamera
            name="camera"
            fov={75}
            aspect={width / height}
            near={0.1}
            far={3000}

            position={this.cameraPosition}
          />
          <lineSegments
            // solid line
            position={new THREE.Vector3(0, 0, 0)}
            rotation={rotation}
            scale={new THREE.Vector3(1, 1, 1)}
          >
            <geometry vertices={getVertices(edges, 150 / Math.pow(edges.length, 0.6))} />
            <lineBasicMaterial
              color={0xFF99FF}
              linewidth={2}
              // wireframe
            />
          </lineSegments>
        </scene>
      </React3>
    );
  }
}

export default class WebpackGraph extends PureComponent {
  state = {
    limit: 1,
    counter: 0,
    scale: 30,
    edges: [],
    nodes: [],

    cubeRotation: new THREE.Euler()
  };

  lastDate = new Date();

  componentDidUpdate(prevProps, prevState) {
    if (this.state.limit !== prevState.limit) {
      this.setState({
        counter: 0
      });
      this.startLayout();
    }
  }

  handleAnimate = () => {
    // we will get this callback every frame

    // pretend cubeRotation is immutable.
    // this helps with updates and pure rendering.
    // React will be sure that the rotation has now updated.

    this.setState({
      cubeRotation: new THREE.Euler(
        0, //this.state.cubeRotation.x + 0.01,
        this.state.cubeRotation.y + 0.03,
        0
      ),
    });
  };

  startLayout() {
    if (this.layout) {
      this.layout.stop();
    }

    const graph = new Graph(buildGraphJSON(this.state.limit));

    this.layout = new Layout.ForceDirected(graph, 1000.0, 100.0, 0.5);

    this.layout.start(() => {
      this.setState({
        edges: this.layout.graph.edges.map(e => {
          const spring = this.layout.spring(e);
          return { id: e.id, p1: spring.point1.p, p2: spring.point2.p };
        }),
        nodes: this.layout.graph.nodes.map(n =>
          ({ id: n.id, p: this.layout.point(n).p })
        ),
        counter: this.state.counter + 1
      });
    });
  }

  componentDidMount() {
    this.startLayout();
  }

  render() {
    const state = this.state;
    const diff = new Date() - this.lastDate;
    this.lastDate = new Date();

    return (
      <div className='clearfix mt4'>
        <div className='col col-4'>
          <div className='col col-8 right-align pr2'>Limit:</div>
          <div className='col col-4 left-align'>
            <input
              className='pl2 pt1 pr2 pb1'
              defaultValue={this.state.limit}
              type='number'
              min={1}
              max={7}
              onChange={e => this.setState({ limit: parseInt(e.target.value, 10) })}
            />
          </div>
          <div className='col col-8 right-align pr2 pt2'>Tree size:</div>
          <div className='col col-4 left-align pt2'>
            {this.state.nodes.length}
          </div>
          <div className='col col-8 right-align pr2 pt2'>Counter:</div>
          <div className='col col-4 left-align pt2'>
            {state.counter} ({diff / 1000} ms)
          </div>
        </div>
        <WebpackGraphTree
          edges={state.edges}
          nodes={state.nodes}
          scale={state.scale}
          className='border col col-8'
          rotation={state.cubeRotation}
          key={state.edges.length}
          onAnimate={this.handleAnimate}
        />
      </div>
    );
  }
}
