import type { FC } from 'react'
import type { LocalContractInfo } from '@/features/phat-contract/atoms'

import React, { Suspense, useState } from 'react'
import tw from 'twin.macro'
import { useAtomValue, } from 'jotai/utils'
import {
  Box, Button, Stack, Skeleton, VStack, Text, Tooltip, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody, ModalFooter,
  useDisclosure,
} from '@chakra-ui/react'
import { Link, useNavigate } from '@tanstack/react-location'
import { AiOutlinePlus, AiOutlineImport, AiOutlineCloudUpload } from 'react-icons/ai'
import { VscLoading } from 'react-icons/vsc'
import { MdCloudDone, MdCloudOff, MdRemoveCircleOutline } from 'react-icons/md'
import { Keyring } from '@polkadot/keyring'

import { useShowAccountSelectModal } from '@/components/app-ui'
import { currentAccountAtom } from '@/features/identity/atoms'
import { useContractList, useRemoveLocalContract } from '@/features/phat-contract/atoms'
import useLocalContractsImport from '@/features/phat-contract/hooks/useLocalContractsImport'
import { apiPromiseAtom, isDevChainAtom } from '@/features/parachain/atoms'
import ChainSummary from '@/features/chain-info/components/ChainSummary'
import { isClosedBetaEnv } from '@/vite-env'

const Summary = () => {
  return (
    <VStack align="flex-start" padding={4} mb={4} borderWidth='1px' borderRadius='lg' tw="bg-black">
      <ChainSummary />
    </VStack>
  )
}

const ContractListSkeleton = () => (
  <Stack tw="mt-2 mb-4 bg-black p-4 max-w-4xl min-w-full">
    <Box borderWidth='1px' borderRadius='lg' overflow='hidden' my="2" bg="gray.800">
      <Skeleton height='48px' />
    </Box>
  </Stack>
)

const PhalaButton = tw(Button)`
  inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md transition-colors
  text-black bg-phalaDark-500
  hover:bg-gray-900 hover:text-phalaDark-500
  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-phala-500
`

const ContractCell: FC<LocalContractInfo & { isLoading: boolean, isAvailable: boolean, contractKey: string }> = ({ contractId, metadata, savedAt, isLoading, isAvailable, contractKey }) => {
  // convert timestamp savedAt to human readable datetime string
  let dateString = null
  if (savedAt) {
    const date = new Date(savedAt)
    dateString = date.toLocaleString()
  }
  const remove = useRemoveLocalContract(contractKey)
  const { isOpen, onOpen, onClose } = useDisclosure()
  return (
    <>
      <Box borderWidth='1px' borderRadius='4px' borderColor="gray.700" overflow='hidden' my="2" p="2" bg="gray.800" tw="flex flex-row justify-between">
        <Link to={`/contracts/view/${contractId}`} disabled={isLoading || !isAvailable}>
          <div css={[isLoading ? tw`animate-pulse` : null, isAvailable ? null : tw`opacity-50`]}>
            <div tw='flex flex-row gap-1.5 items-center text-xs'>
              {isLoading ? <VscLoading tw='animate-spin text-phala-200' /> : (
                isAvailable ? (
                  <MdCloudDone tw="text-phala-500" />
                ) : (
                  <Tooltip label="Unavailble">
                    <span>
                      <MdCloudOff tw='text-gray-500' />
                    </span>
                  </Tooltip>
                )
              )}
              <div tw="font-mono text-xs text-gray-400">
                {contractId.substring(0, 6)}...{contractId.substring(contractId.length - 6)}
              </div>
            </div>
            <header tw="flex flex-row items-center">
              <h4 tw="text-xl">{metadata.contract.name}</h4>
              <div tw="mt-1 ml-2 text-sm text-gray-200">{metadata.contract.version}</div>
            </header>
          </div>
        </Link>
        <div tw="flex flex-col gap-1">
          {dateString && (
            <div tw="text-sm text-gray-400">{dateString}</div>
          )}
          <div tw="flex flex-row-reverse">
            <Button onClick={() => onOpen()} size="xs">
              <MdRemoveCircleOutline />
            </Button>
          </div>
        </div>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Remove contract</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <p>This operation won't REMOVE the contract on-chain, it ONLY remove the infomation saved in your local storage.</p>
          </ModalBody>
          <ModalFooter>
            <Button variant='ghost' size="sm" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme='phalaDark' size="sm" onClick={() => {
              onClose()
              remove()
            }}>Continue</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  )
}

const ContractList = () => {
  const contracts = useContractList()
  const account = useAtomValue(currentAccountAtom)
  const showAccountSelectModal = useShowAccountSelectModal()
  const navigate = useNavigate()
  const contractImport = useLocalContractsImport()
  const [availableOnly, setAvailableOnly] = useState(false)
  const filtered = contracts.filter(i => availableOnly ? i[1].isAvailable : true)
  return (
    <>
      <div tw="flex flex-row justify-between items-center">
        {!!account ? (
          <div tw="flex flex-row gap-0.5">
            <Link to="/contracts/add">
              <Button bg="black" borderRadius={0} as="span">Upload</Button>
            </Link>
            <Link to="/contracts/attach">
              <Button bg="black" borderRadius={0} as="span">Attach</Button>
            </Link>
            <Button bg="black" borderRadius={0} as="label" tw="cursor-pointer">
              <input type="file" tw="hidden" onChange={contractImport} />
              Import
            </Button>
          </div>
        ) : (<div />)}
        <div tw="pr-1">
          <Checkbox colorScheme="phalaDark" onChange={() => setAvailableOnly(i => !i)} checked={availableOnly}>
            <span tw="text-gray-300 text-base">Show Available Only</span>
          </Checkbox>
        </div>
      </div>
      <div tw="mt-2 mb-4 bg-black p-4 max-w-4xl min-w-full">
        {filtered.length === 0 ? (
        <div tw="bg-black py-6 min-w-full text-center">
          <svg
            tw="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 tw="mt-2 text-sm font-medium text-gray-400">No Contract</h3>
          <p tw="mt-1 text-sm text-gray-500">Get started by uploading a new Phat Contract.</p>
          <div tw="mt-6 mb-4 flex flex-row gap-2 justify-center">
            <PhalaButton
              onClick={() => {
                if (!account) {
                  showAccountSelectModal()
                  // setConnectionDetailModalVisible(true)
                } else {
                  navigate({ to: '/contracts/add' })
                }
              }}
            >
              <AiOutlinePlus tw="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              {!!account ? 'Upload' : 'Sign In'}
            </PhalaButton>
            {!!account && (
              <Link to="/contracts/attach">
                <PhalaButton tw="cursor-pointer">
                  <AiOutlineCloudUpload tw="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  Attach
                </PhalaButton>
              </Link>
            )}
            {!!account && (
              <PhalaButton as="label" tw="cursor-pointer">
                <input type="file" tw="hidden" onChange={contractImport} />
                <AiOutlineImport tw="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Import
              </PhalaButton>
            )}
          </div>
        </div>
        ) : null}
        {filtered.map(([key, info], i) => (
          <div key={`${key}-${i}`}>
            <ContractCell {...info} contractKey={key} />
          </div>
        ))}
      </div>
    </>
  )
}

const GetTestPhaButtonNormal = () => {
  const api = useAtomValue(apiPromiseAtom)
  const isDevChain = useAtomValue(isDevChainAtom)
  const account = useAtomValue(currentAccountAtom)
  const [loading, setLoading] = useState(false)
  if (!account || !isDevChain) {
    return null
  }
  async function getTestCoin () {
    setLoading(true)
    const keyring = new Keyring({ type: 'sr25519' })
    const pair = keyring.addFromUri('//Alice')
    await api.tx.balances.transferKeepAlive(account?.address, '100000000000000')
      .signAndSend(pair, { nonce: -1 })
    setLoading(false)
  }
  return (
    <Button
      w="full"
      isLoading={loading}
      onClick={getTestCoin}
    >
      Get Test-PHA
    </Button>
  )
}

const GetTestPhaButtonClosedBeta = () => {
  const account = useAtomValue(currentAccountAtom)
  if (!account) {
    return null
  }
  return (
    <Button
      w="full"
      as="a"
      target="_blank"
      href="https://discord.com/channels/697726436211163147/1052518183766073354"
    >
      Get Test-PHA
    </Button>
  )
}

const GetTestPhaButton = isClosedBetaEnv ? GetTestPhaButtonClosedBeta : GetTestPhaButtonNormal

const ContractListPage = () => {
  const awesomeHref = isClosedBetaEnv
    ? 'https://github.com/Phala-Network/awesome-phat-contracts'
    : 'https://github.com/Phala-Network/awesome-fat-contracts'
  const oracleHref = isClosedBetaEnv
    ? 'https://github.com/Phala-Network/phat-offchain-rollup/tree/sub0-workshop/phat'
    : 'https://github.com/Phala-Network/phat-offchain-rollup/blob/main/phat/Sub0-Workshop.md'
  return (
    <div tw="pl-5 pr-5">
      <div tw="grid grid-cols-12 w-full gap-2">
        <div tw="col-span-3 order-2 pl-6">
          <Suspense fallback={null}>
            <Summary />
          </Suspense>
          <div tw="flex flex-col gap-4">
            {
              isClosedBetaEnv
                ? <Button w="full" as="a" href="https://wiki.phala.network/en-us/build/general/closed-beta/" target="_blank">Getting Started</Button>
                : <Button w="full" as="a" href="https://wiki.phala.network/" target="_blank">Wiki</Button>
            }
            <Button w="full" as="a" href="https://discord.gg/phala" target="_blank">Discord</Button>
            <Button w="full" as="a" href={awesomeHref} target="_blank">
              Awesome Phat Contract
            </Button>
            {
              isClosedBetaEnv
                ? (
                  <Button w="full" as="a" href="https://github.com/Phala-Network/phat-contract-examples" target="_blank">
                    Phat Contract Examples
                  </Button>
                )
                : null
            }
            <Button w="full" as="a" href={oracleHref} target="_blank">
              Oracle Workshop
            </Button>
            <Suspense>
              <GetTestPhaButton />
            </Suspense>
          </div>
        </div>
        <div tw="col-span-9 order-1">
          <Suspense fallback={<ContractListSkeleton />}>
            <ContractList />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

export default ContractListPage
