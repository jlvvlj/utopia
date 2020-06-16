import * as React from 'react'
import { colorTheme } from 'uuiui'
import { MetadataUtils } from '../../../core/model/element-metadata-utils'
import { ComponentMetadata, UtopiaJSXComponent } from '../../../core/shared/element-template'
import { Imports, TemplatePath } from '../../../core/shared/project-file-types'
import Utils from '../../../utils/utils'
import * as TP from '../../../core/shared/template-path'
import { ControlProps } from './new-canvas-controls'
import { Outline } from './outline'
import { anyInstanceYogaLayouted } from './select-mode/yoga-utils'
import { MarginControls } from './margin-controls'
import { PaddingControls } from './padding-controls'
import { MoveDragState, ResizeDragState, DragState } from '../canvas-types'
import { CanvasRectangle, offsetRect } from '../../../core/shared/math-utils'

export function getSelectionColor(
  path: TemplatePath,
  rootElements: Array<UtopiaJSXComponent>,
  metadata: ComponentMetadata[],
  imports: Imports,
  createsYogaLayout: boolean,
  anySelectedElementIsYogaLayouted: boolean,
): string {
  if (TP.isScenePath(path)) {
    return colorTheme.canvasSelectionSceneOutline.value
  } else {
    if (MetadataUtils.isComponentInstance(path, rootElements, metadata, imports)) {
      return colorTheme.canvasSelectionInstanceOutline.value
    }
    const originType = MetadataUtils.getElementOriginType(rootElements, metadata, path)
    if (originType === 'generated-static-definition-present' || originType === 'unknown-element') {
      return colorTheme.canvasSelectionRandomDOMElementInstanceOutline.value
    } else if (createsYogaLayout) {
      return colorTheme.canvasSelectionAlternateOutlineYogaParent.value
    } else if (anySelectedElementIsYogaLayouted) {
      return colorTheme.canvasSelectionAlternateOutlineYogaChild.value
    } else {
      return colorTheme.canvasSelectionPrimaryOutline.value
    }
  }
}

export interface OutlineControlsProps extends ControlProps {
  dragState: MoveDragState | ResizeDragState | null
}

function isDraggingToMove(
  dragState: MoveDragState | ResizeDragState | null,
  target: TemplatePath,
): dragState is MoveDragState {
  // This is a bit of a cheeky cast because we only cast if the thing is target is one of the dragged elements
  const targetIsDragged = TP.containsPath(target, dragState?.draggedElements ?? [])
  return dragState != null && dragState?.type === 'MOVE_DRAG_STATE' && targetIsDragged
}

export class OutlineControls extends React.Component<OutlineControlsProps> {
  getDragStateFrame = (target: TemplatePath): CanvasRectangle | null => {
    const { dragState } = this.props
    if (isDraggingToMove(dragState, target)) {
      const startingFrameAndTarget = dragState.originalFrames.find((frameAndTarget) =>
        TP.pathsEqual(frameAndTarget.target, target),
      )
      if (
        startingFrameAndTarget == null ||
        startingFrameAndTarget.frame == null ||
        dragState.drag == null
      ) {
        return null
      } else {
        return offsetRect(startingFrameAndTarget.frame, dragState.drag)
      }
    } else {
      return null
    }
  }

  getTargetFrame = (target: TemplatePath): CanvasRectangle | null => {
    const dragRect = this.getDragStateFrame(target)
    return dragRect ?? MetadataUtils.getFrameInCanvasCoords(target, this.props.componentMetadata)
  }

  render() {
    const anySelectedElementIsYogaLayouted = anyInstanceYogaLayouted(
      this.props.componentMetadata,
      this.props.selectedViews,
    )

    let selectionOutlines: Array<JSX.Element> = []
    const targetPaths =
      this.props.dragState != null ? this.props.dragState.draggedElements : this.props.selectedViews
    Utils.fastForEach(targetPaths, (selectedView) => {
      const rect = this.getTargetFrame(selectedView)
      if (rect == null) {
        // early return as we can't draw a selection outline
        return
      }

      const instance = TP.isScenePath(selectedView)
        ? null
        : MetadataUtils.getElementByInstancePathMaybe(this.props.componentMetadata, selectedView)
      const createsYogaLayout = MetadataUtils.isFlexLayoutedContainer(instance)
      const selectionColor = getSelectionColor(
        selectedView,
        this.props.rootComponents,
        this.props.componentMetadata,
        this.props.imports,
        createsYogaLayout,
        anySelectedElementIsYogaLayouted,
      )

      // FIXME Remove margin and padding controls from here
      // const margin = MetadataUtils.getElementMargin(selectedView, this.props.componentMetadata)
      // selectionOutlines.push(
      //   <MarginControls
      //     canvasOffset={this.props.canvasOffset}
      //     scale={this.props.scale}
      //     margin={margin}
      //     frame={rect}
      //   />,
      // )
      // const padding = MetadataUtils.getElementPadding(selectedView, this.props.componentMetadata)
      // selectionOutlines.push(
      //   <PaddingControls
      //     canvasOffset={this.props.canvasOffset}
      //     scale={this.props.scale}
      //     padding={padding}
      //     frame={rect}
      //   />,
      // )

      selectionOutlines.push(
        <Outline
          key={TP.toComponentId(selectedView)}
          rect={rect}
          offset={this.props.canvasOffset}
          scale={this.props.scale}
          color={selectionColor}
          striped={createsYogaLayout}
          stripedColor={colorTheme.canvasSelectionAlternateOutlineYogaParent.shade(50).value}
        />,
      )
    })
    let multiSelectOutline: JSX.Element | undefined
    if (
      targetPaths.length > 1 &&
      TP.areAllElementsInSameScene(targetPaths) &&
      this.props.componentMetadata.length > 0
    ) {
      const globalFrames = targetPaths.map((selectedView) => this.getTargetFrame(selectedView))
      const boundingBox = Utils.boundingRectangleArray(globalFrames)
      if (boundingBox != null) {
        const outlineColor = colorTheme.canvasSelectionSecondaryOutline.value
        multiSelectOutline = (
          <Outline
            rect={boundingBox}
            offset={this.props.canvasOffset}
            scale={this.props.scale}
            color={outlineColor}
          />
        )
      }
    }
    return (
      <>
        {...selectionOutlines}
        {multiSelectOutline}
      </>
    )
  }
}
