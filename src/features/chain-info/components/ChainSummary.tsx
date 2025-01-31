import React from 'react'
import tw from 'twin.macro'
import { useAtomValue, useSetAtom } from 'jotai';
import { Box, Text, Tooltip, Button, TableContainer, Table, Tbody, Tr, Td } from '@chakra-ui/react'
import { useLastBlock } from '../hooks/useLastBlock'
import { useTarget } from '../hooks/useTarget';
import { bestNumberAtom, lastEventsAtom } from '../atoms';
import { endpointAtom } from '@/atoms/endpointsAtom';
import { dispatchOpenTabAtom, TabIndex } from '@/components/StatusBar';

const BlockTarget = () => {
  const target = useTarget();

  return (
    <>
      {
        target.split(' ').map((value, index) =>
          <span
            key={index}
            tw="font-mono"
          >{value}</span>
        )
      }
    </>
  )
}

const ChainSummary = () => {
  const lastBlock = useLastBlock()
  const lastEvents = useAtomValue(lastEventsAtom)
  const bestNumber = useAtomValue(bestNumberAtom)
  const endpoint = useAtomValue(endpointAtom)
  const dispatchOpenTab = useSetAtom(dispatchOpenTabAtom)
  const portalHref = `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(endpoint)}`

  const openRecentEvents = () => {
    dispatchOpenTab(TabIndex.RecentEvents)
  }

  const openRecentBlocks = () => {
    dispatchOpenTab(TabIndex.RecentBlocks)
  }

  return (
    <Box maxW="full">
      <TableContainer>
        <Table variant="unstyled" size="sm">
          <Tbody>
            <Tr onClick={openRecentBlocks} cursor="pointer" tw="hover:opacity-80">
              <Td tw="px-0 py-1 text-right w-0">Last block</Td>
              <Td tw="pl-3 py-1 font-mono">{lastBlock}</Td>
            </Tr>
            <Tr>
              <Td tw="px-0 py-1 text-right w-0">Target</Td>
              <Td tw="pl-3 py-1 font-mono">
                <BlockTarget />
              </Td>
            </Tr>
            <Tr onClick={openRecentEvents} cursor="pointer" tw="hover:opacity-80">
              <Td tw="px-0 py-1 text-right w-0">Last events</Td>
              <Td tw="pl-3 py-1 font-mono">{lastEvents}</Td>
            </Tr>
            <Tr>
              <Td tw="px-0 py-1 text-right w-0">Best</Td>
              <Td tw="pl-3 py-1 font-mono">{bestNumber}</Td>
            </Tr>
          </Tbody>
        </Table>
      </TableContainer>
      <Button as="a" href={portalHref} target="_blank" w="full" mt={2} fontSize={12}>Open with Polkadot/Substrate Portal</Button>
    </Box>
  )
}

export default ChainSummary