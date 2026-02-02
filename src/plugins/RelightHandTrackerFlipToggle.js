import { MiradorMenuButton } from 'mirador/dist/es/src/components/MiradorMenuButton';
import React from 'react';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import PropTypes from 'prop-types';

/**
 * The RelightHandTrackerFlipToggle component is a toggle button that controls X-axis flipping for hand tracking.
 * When active, the horizontal hand movement direction is inverted.
 * The icon changes opacity to indicate active/inactive states.
 */
class RelightHandTrackerFlipToggle extends React.Component {
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
            ? 'Disable X-axis flip (normal horizontal direction)'
            : 'Enable X-axis flip (invert horizontal direction)'
        }
        onClick={onClick}
        style={{
          opacity: active ? 1 : 0.5,
        }}
      >
        <SwapHorizIcon />
      </MiradorMenuButton>
    );
  }
}

RelightHandTrackerFlipToggle.propTypes = {
  /** The id prop is used to populate the html id property so that we can keep track of the controls state **/
  id: PropTypes.string.isRequired,
  /** The active prop indicates whether X-axis flipping is currently enabled **/
  active: PropTypes.bool,
  /** The onClick prop is a function used to manage component behaviour when the component is clicked **/
  onClick: PropTypes.func.isRequired,
};

RelightHandTrackerFlipToggle.defaultProps = {
  active: false,
};

export default RelightHandTrackerFlipToggle;
