import { MiradorMenuButton } from 'mirador/dist/es/src/components/MiradorMenuButton';
import React from 'react';
import VisibilityIcon from '@material-ui/icons/Visibility';
import VisibilityOffIcon from '@material-ui/icons/VisibilityOff';
import PropTypes from 'prop-types';

/**
 * The RelightHandTrackerDebugToggle component is a toggle button that shows/hides the hand tracking debugger view.
 * When active, the webcam canvas with hand landmarks is visible. When inactive, only a status notification is shown.
 * The icon toggles between visibility (active) and visibility off (inactive) states.
 */
class RelightHandTrackerDebugToggle extends React.Component {
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
            ? 'Hide hand tracking debugger view'
            : 'Show hand tracking debugger view'
        }
        onClick={onClick}
      >
        {active ? <VisibilityIcon /> : <VisibilityOffIcon />}
      </MiradorMenuButton>
    );
  }
}

RelightHandTrackerDebugToggle.propTypes = {
  /** The id prop is used to populate the html id property so that we can keep track of the controls state **/
  id: PropTypes.string.isRequired,
  /** The active prop indicates whether the debugger view is currently visible **/
  active: PropTypes.bool,
  /** The onClick prop is a function used to manage component behaviour when the component is clicked **/
  onClick: PropTypes.func.isRequired,
};

RelightHandTrackerDebugToggle.defaultProps = {
  active: true,
};

export default RelightHandTrackerDebugToggle;
