import { MiradorMenuButton } from 'mirador/dist/es/src/components/MiradorMenuButton';
import React from 'react';
import PanToolIcon from '@material-ui/icons/PanTool';
import PanToolOutlinedIcon from '@material-ui/icons/PanToolOutlined';
import PropTypes from 'prop-types';

/**
 * The RelightHandTrackingButton component is a toggle button that enables/disables hand tracking mode.
 * When active, it uses MediaPipe to track the right hand and control the directional light.
 * The icon toggles between filled (active) and outlined (inactive) states.
 */
class RelightHandTrackingButton extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { active, onClick, id } = this.props;
    return (
      <MiradorMenuButton
        id={id}
        aria-label={
          active
            ? 'Disable hand tracking mode and return to mouse control'
            : 'Enable hand tracking mode to control light with your hand'
        }
        onClick={onClick}
      >
        {active ? <PanToolIcon /> : <PanToolOutlinedIcon />}
      </MiradorMenuButton>
    );
  }
}

RelightHandTrackingButton.propTypes = {
  /** The id prop is used to populate the html id property so that we can keep track of the controls state **/
  id: PropTypes.string.isRequired,
  /** The active prop indicates whether hand tracking mode is currently enabled **/
  active: PropTypes.bool,
  /** The onClick prop is a function used to manage component behaviour when the component is clicked **/
  onClick: PropTypes.func.isRequired,
};

RelightHandTrackingButton.defaultProps = {
  active: false,
};

export default RelightHandTrackingButton;
