/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx, Theme } from '@emotion/react'
import React from 'react'
import { BreadcrumbTrail } from '../canvas/controls/breadcrumb-trail'
import {
  FlexRow,
  Icn,
  IcnColor,
  Icons,
  OnClickOutsideHOC,
  SmallerIcons,
  useColorTheme,
  UtopiaStyles,
  UtopiaTheme,
} from '../../uuiui'
import { RenderAsRow } from '../canvas/controls/render-as'
import { useEditorState } from './store/store-hook'
import * as EP from '../../core/shared/element-path'
import { MetadataUtils } from '../../core/model/element-metadata-utils'
import { setFocusedElement } from './actions/action-creators'
import { Interpolation } from '@emotion/serialize'

export const ComponentOrInstanceIndicator = React.memo(() => {
  const { isComponent, focusedElementPath, selectedViews } = useEditorState((store) => {
    const target = store.editor.selectedViews[0]

    const isFocusableComponent =
      target == null ? false : MetadataUtils.isFocusableComponent(target, store.editor.jsxMetadata)

    return {
      isComponent: isFocusableComponent,
      focusedElementPath: store.editor.focusedElementPath,
      selectedViews: store.editor.selectedViews,
    }
  }, 'Component-button')

  const dispatch = useEditorState((state) => state.dispatch, 'ComponentOrInstanceIndicator')
  const colorTheme = useColorTheme()
  const popupEnabled = selectedViews.length > 0

  const [isOpen, setIsOpen] = React.useState(false)
  const toggleOpen = React.useCallback(() => {
    setIsOpen((currentValue) => !currentValue)
  }, [])

  const closeAndEatEvent = React.useCallback(
    (e: MouseEvent) => {
      setIsOpen(false)
      e.stopPropagation()
      e.preventDefault()
    },
    [setIsOpen],
  )

  const target = selectedViews[0]

  const isFocused = target == null ? false : EP.isFocused(focusedElementPath, target)

  const toggleFocusMode = React.useCallback(() => {
    dispatch([setFocusedElement(isFocused ? null : target)])
  }, [dispatch, isFocused, target])

  const editContextStyle: React.CSSProperties = React.useMemo(() => {
    if (target != null) {
      if (isComponent && !isFocused) {
        return {
          color: colorTheme.component.value,
          backgroundColor: colorTheme.component.shade(10).value,
        }
      } else if (isFocused && isComponent) {
        return {
          color: colorTheme.componentChild.value,
          backgroundColor: colorTheme.componentChild.shade(10).value,
        }
      } else {
        return {
          background: colorTheme.secondaryBackground.value,
          color: colorTheme.neutralForeground.value,
          opacity: 0.5,
          pointerEvents: 'none',
        }
      }
    } else {
      return {
        background: colorTheme.secondaryBackground.value,
        color: colorTheme.neutralForeground.value,
        stroke: 'black',
        opacity: 0.5,
        pointerEvents: 'none',
      }
    }
  }, [target, isComponent, isFocused, colorTheme])

  const flexRowTheme: Interpolation<Theme> = React.useMemo(() => {
    return {
      flexGrow: 1,
      flexShrink: 1,
      overflow: 'hidden',
      borderTopLeftRadius: UtopiaTheme.inputBorderRadius,
      borderBottomLeftRadius: UtopiaTheme.inputBorderRadius,
      gap: 8,
      paddingLeft: 4,
      cursor: 'pointer',
      transition: 'background-color .1s ease-in-out',
      ...editContextStyle,
      '&:hover': {
        filter: 'brightness(1.02  )',
      },
      '&:active': {
        filter: 'brightness(1.03)',
      },
    }
  }, [editContextStyle])

  return (
    <div
      role='compositeButton'
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'stretch',
        height: UtopiaTheme.layout.inputHeight.default,
        flexBasis: 38,
      }}
    >
      <FlexRow role='button' onClick={toggleFocusMode} css={flexRowTheme}>
        {isComponent ? (
          <Icons.Component color={editContextStyle.stroke as IcnColor} />
        ) : (
          <Icn
            category='element'
            type='ghost'
            width={18}
            height={18}
            color={editContextStyle.stroke as IcnColor}
          />
        )}
      </FlexRow>

      <div
        className='ignore-react-onclickoutside'
        role='expansionButton'
        css={{
          pointerEvents: popupEnabled ? 'initial' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexGrow: 0,
          flexShrink: 0,
          flexBasis: 14,
          transition: 'background-color .1s ease-in-out',
          ...editContextStyle,
          // slightly darker than the button next to it
          filter: 'brightness(.99)',
          borderLeft: `1px dashed ${colorTheme.secondaryBorder.value}`,
          cursor: 'pointer',
          borderTopRightRadius: UtopiaTheme.inputBorderRadius,
          borderBottomRightRadius: UtopiaTheme.inputBorderRadius,
          '&:hover': {
            filter: 'brightness(1.01)',
          },
          '&:active > *': {
            transform: 'translateY(1px)',
          },
          '&:active': {
            filter: 'brightness(1.03)',
          },
        }}
        onClick={toggleOpen}
      >
        <SmallerIcons.ExpansionArrowDown
          isDisabled={!popupEnabled}
          color={editContextStyle.stroke as IcnColor}
          style={{
            flexGrow: 0,
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : undefined,
          }}
        />
      </div>

      {isOpen ? (
        <OnClickOutsideHOC onClickOutside={closeAndEatEvent}>
          <div
            tabIndex={0}
            style={{
              position: 'absolute',
              left: 0,
              top: 30,
              zIndex: 1,
              width: UtopiaTheme.layout.inspectorSmallWidth, // TODO should this be resize-aware
              height: 100,
              ...UtopiaStyles.popup,
              display: 'flex',
              flexDirection: 'column',
              alignContent: 'flex-start',
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <BreadcrumbTrail />
            <RenderAsRow />
          </div>
        </OnClickOutsideHOC>
      ) : null}
    </div>
  )
})
